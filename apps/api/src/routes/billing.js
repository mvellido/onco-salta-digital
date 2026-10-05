import { sendError, sendServerError, sendValidationError } from '../infra/errors.js';
import { validatePayload } from '../infra/validation.js';
import { canAccessPatient, getAccessiblePatientIds } from '../modules/shared/access.js';
import {
  listBillingRecords,
  createBillingRecord,
  buildBillingReport,
  runReconciliation,
} from '../modules/billing/index.js';

export default async function billingRoutes(app, { supabase, authenticate, audit }) {
  // GET /billing/reports - Resumen financiero dentro del alcance del usuario
  app.get('/billing/reports', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'billing:read');
    if (!ctx) return;

    try {
      const patientIds = await getAccessiblePatientIds(supabase, ctx);
      const records = await listBillingRecords(supabase, patientIds);
      return reply.code(200).send(buildBillingReport(records));
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /billing/reports');
    }
  });

  // POST /billing/records - Crea registro financiero asociado a paciente
  app.post('/billing/records', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'billing:write');
    if (!ctx) return;

    const validation = validatePayload('billingCreate', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Payload inválido para registro financiero', validation.errors);
    }

    const payload = request.body;

    try {
      if (!(await canAccessPatient(supabase, payload.patient_id, ctx))) {
        return sendError(reply, 403, 'No tienes permisos para registrar facturación de este paciente');
      }

      const record = await createBillingRecord(supabase, {
        patient_id: payload.patient_id,
        invoice_number: payload.invoice_number,
        amount: payload.amount,
        currency: payload.currency || 'ARS',
        status: payload.status || 'pending',
        issued_at: payload.issued_at || new Date().toISOString(),
        paid_at: payload.paid_at || null,
        payer_name: payload.payer_name || null,
        payer_id: payload.payer_id || null,
        authorization_id: payload.authorization_id || null,
        notes: payload.notes || null,
        created_by: ctx.userId,
      });

      await audit({
        actorId: ctx.userId,
        patientId: payload.patient_id,
        resourceType: 'billing_record',
        resourceId: record.id,
        action: 'billing_record_create',
        details: { invoice_number: record.invoice_number, amount: record.amount, status: record.status },
      });

      return reply.code(201).send(record);
    } catch (err) {
      if (err?.code === '23505') {
        return sendError(reply, 409, 'Ya existe una factura con ese número.');
      }
      if (err?.code === '23514') {
        return sendError(reply, 400, 'Estado de factura inválido. Usá pending, paid, overdue o cancelled.');
      }
      return sendServerError(request, reply, err, 'Exception in POST /billing/records');
    }
  });

  // POST /billing/conciliate - Motor de conciliación financiera
  app.post('/billing/conciliate', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'billing:write');
    if (!ctx) return;

    const validation = validatePayload('billingConciliate', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Payload inválido para conciliación', validation.errors);
    }

    const { records, expectedTotal = null } = request.body;

    try {
      const result = runReconciliation(records, expectedTotal);

      await audit({
        actorId: ctx.userId,
        resourceType: 'billing',
        action: 'billing_conciliation_run',
        details: {
          total_records: result.summary.totalRecords,
          matched_count: result.summary.matchedCount,
          unmatched_count: result.summary.unmatchedCount,
          expected_total: result.summary.expectedTotal,
          delta: result.summary.delta,
        },
      });

      return reply.code(200).send(result);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /billing/conciliate');
    }
  });
}
