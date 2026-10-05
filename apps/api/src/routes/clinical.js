import { sendError, sendServerError, sendValidationError } from '../infra/errors.js';
import { validatePayload } from '../infra/validation.js';
import { canAccessPatient } from '../modules/shared/access.js';
import {
  findClinicalRow,
  insertClinicalRow,
  updateClinicalRow,
  normalizeTumorInput,
  validateTreatmentRules,
} from '../modules/clinical/index.js';

// Tumores y tratamientos: altas y cambios auditados. No hay borrado: un tumor o
// tratamiento cargado por error se corrige o se marca (status), como el resto de
// la historia clínica.
export default async function clinicalRoutes(app, { supabase, authenticate, audit }) {
  async function guardPatient(request, reply, patientId, ctx) {
    if (!(await canAccessPatient(supabase, patientId, ctx))) {
      sendError(reply, 404, 'Paciente no encontrado o sin permisos');
      return false;
    }
    return true;
  }

  async function loadOwnedRow(request, reply, table, ctx, label) {
    const row = await findClinicalRow(supabase, table, request.params.id);
    if (!row || !(await canAccessPatient(supabase, row.patient_id, ctx))) {
      sendError(reply, 404, `${label} no encontrado`);
      return null;
    }
    return row;
  }

  async function tumorBelongsToPatient(tumorId, patientId) {
    if (!tumorId) return true;
    const tumor = await findClinicalRow(supabase, 'tumors', tumorId);
    return tumor?.patient_id === patientId;
  }

  // POST /patients/:id/tumors
  app.post('/patients/:id/tumors', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'patients:write');
    if (!ctx) return;

    const validation = validatePayload('tumorCreate', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Datos del tumor inválidos', validation.errors);
    }

    try {
      const patientId = request.params.id;
      if (!(await guardPatient(request, reply, patientId, ctx))) return;

      const tumor = await insertClinicalRow(supabase, 'tumors', {
        ...normalizeTumorInput(request.body),
        patient_id: patientId,
        created_by: ctx.userId,
      });

      await audit({
        actorId: ctx.userId,
        patientId,
        resourceType: 'tumor',
        resourceId: tumor.id,
        action: 'tumor_create',
        details: { primary_site: tumor.primary_site, stage_group: tumor.stage_group },
      });

      return reply.code(201).send(tumor);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /patients/:id/tumors');
    }
  });

  // PUT /tumors/:id
  app.put('/tumors/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'patients:write');
    if (!ctx) return;

    const validation = validatePayload('tumorUpdate', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Datos del tumor inválidos', validation.errors);
    }

    try {
      const current = await loadOwnedRow(request, reply, 'tumors', ctx, 'Tumor');
      if (!current) return;

      const changes = normalizeTumorInput(request.body);
      const tumor = await updateClinicalRow(supabase, 'tumors', current.id, changes);

      await audit({
        actorId: ctx.userId,
        patientId: current.patient_id,
        resourceType: 'tumor',
        resourceId: current.id,
        action: 'tumor_update',
        details: { updated_fields: Object.keys(changes) },
      });

      return tumor;
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in PUT /tumors/:id');
    }
  });

  // POST /patients/:id/treatments
  app.post('/patients/:id/treatments', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'patients:write');
    if (!ctx) return;

    const validation = validatePayload('treatmentCreate', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Datos del tratamiento inválidos', validation.errors);
    }

    const ruleError = validateTreatmentRules(request.body);
    if (ruleError) return sendError(reply, 400, ruleError);

    try {
      const patientId = request.params.id;
      if (!(await guardPatient(request, reply, patientId, ctx))) return;

      if (!(await tumorBelongsToPatient(request.body.tumor_id, patientId))) {
        return sendError(reply, 400, 'El tumor indicado no pertenece a este paciente.');
      }

      const treatment = await insertClinicalRow(supabase, 'treatments', {
        ...request.body,
        patient_id: patientId,
        created_by: ctx.userId,
      });

      await audit({
        actorId: ctx.userId,
        patientId,
        resourceType: 'treatment',
        resourceId: treatment.id,
        action: 'treatment_create',
        details: { kind: treatment.kind, regimen: treatment.regimen, status: treatment.status },
      });

      return reply.code(201).send(treatment);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /patients/:id/treatments');
    }
  });

  // PUT /treatments/:id
  app.put('/treatments/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'patients:write');
    if (!ctx) return;

    const validation = validatePayload('treatmentUpdate', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Datos del tratamiento inválidos', validation.errors);
    }

    try {
      const current = await loadOwnedRow(request, reply, 'treatments', ctx, 'Tratamiento');
      if (!current) return;

      const ruleError = validateTreatmentRules({ ...current, ...request.body });
      if (ruleError) return sendError(reply, 400, ruleError);

      if (!(await tumorBelongsToPatient(request.body.tumor_id, current.patient_id))) {
        return sendError(reply, 400, 'El tumor indicado no pertenece a este paciente.');
      }

      const treatment = await updateClinicalRow(supabase, 'treatments', current.id, request.body);

      await audit({
        actorId: ctx.userId,
        patientId: current.patient_id,
        resourceType: 'treatment',
        resourceId: current.id,
        action: 'treatment_update',
        details: { updated_fields: Object.keys(request.body), status: treatment.status },
      });

      return treatment;
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in PUT /treatments/:id');
    }
  });
}
