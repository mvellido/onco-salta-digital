import { sendError, sendServerError, sendValidationError } from '../infra/errors.js';
import { validatePayload } from '../infra/validation.js';
import { canAccessPatient, getAccessiblePatientIds } from '../modules/shared/access.js';
import { applyAuthorizationChange, withExpiry } from '../modules/coverage/index.js';

const AUTH_COLUMNS = 'id, patient_id, coverage_id, payer_id, treatment_id, item, quantity, status, requested_on, responded_on, authorization_number, valid_until, notes, created_at, updated_at, payer:payers(name), patient:patients(full_name)';
const COVERAGE_COLUMNS = 'id, patient_id, payer_id, member_number, plan, valid_from, valid_to, is_primary, created_at, payer:payers(name, kind)';

export default async function coverageRoutes(app, { supabase, authenticate, audit }) {
  const READ = ['coverage:manage', 'billing:read', 'patients:read', 'patients:read_basic'];
  const PAYER_WRITE = ['coverage:manage', 'billing:write'];
  const PATIENT_WRITE = ['coverage:manage', 'patients:write'];

  async function guardPatient(reply, patientId, ctx) {
    if (await canAccessPatient(supabase, patientId, ctx)) return true;
    sendError(reply, 404, 'Paciente no encontrado o sin permisos');
    return false;
  }

  async function one(table, id, columns = '*') {
    const { data, error } = await supabase.from(table).select(columns).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  // ------------------------------------------------------------- financiadores

  app.get('/payers', async (request, reply) => {
    const ctx = await authenticate(request, reply, READ);
    if (!ctx) return undefined;
    try {
      let query = supabase.from('payers').select('id, name, kind, rnos, cuit, contact, active');
      if (request.query?.all !== 'true') query = query.eq('active', true);
      const { data, error } = await query.order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /payers');
    }
  });

  app.post('/payers', async (request, reply) => {
    const ctx = await authenticate(request, reply, PAYER_WRITE);
    if (!ctx) return undefined;
    const validation = validatePayload('payerCreate', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Datos del financiador inválidos', validation.errors);
    try {
      const { data, error } = await supabase.from('payers').insert([{ active: true, ...request.body, name: request.body.name.trim() }]).select().single();
      if (error) throw error;
      await audit({ actorId: ctx.userId, resourceType: 'payer', resourceId: data.id, action: 'payer_create', details: { name: data.name } });
      return reply.code(201).send(data);
    } catch (err) {
      if (err?.code === '23505') return sendError(reply, 409, 'Ya existe un financiador con ese nombre.');
      return sendServerError(request, reply, err, 'Exception in POST /payers');
    }
  });

  app.patch('/payers/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, PAYER_WRITE);
    if (!ctx) return undefined;
    const validation = validatePayload('payerUpdate', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Datos del financiador inválidos', validation.errors);
    try {
      const { data, error } = await supabase.from('payers').update(request.body).eq('id', request.params.id).select().maybeSingle();
      if (error) throw error;
      if (!data) return sendError(reply, 404, 'Financiador no encontrado');
      await audit({ actorId: ctx.userId, resourceType: 'payer', resourceId: data.id, action: 'payer_update', details: request.body });
      return data;
    } catch (err) {
      if (err?.code === '23505') return sendError(reply, 409, 'Ya existe un financiador con ese nombre.');
      return sendServerError(request, reply, err, 'Exception in PATCH /payers/:id');
    }
  });

  // ------------------------------------------------------------- coberturas del paciente

  app.get('/patients/:id/coverages', async (request, reply) => {
    const ctx = await authenticate(request, reply, READ);
    if (!ctx) return undefined;
    try {
      if (!(await guardPatient(reply, request.params.id, ctx))) return undefined;
      const { data, error } = await supabase.from('patient_coverages').select(COVERAGE_COLUMNS).eq('patient_id', request.params.id).order('is_primary', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /patients/:id/coverages');
    }
  });

  async function unsetOtherPrimaries(patientId, keepId) {
    let query = supabase.from('patient_coverages').update({ is_primary: false }).eq('patient_id', patientId).eq('is_primary', true);
    if (keepId) query = query.neq('id', keepId);
    const { error } = await query;
    if (error) throw error;
  }

  app.post('/patients/:id/coverages', async (request, reply) => {
    const ctx = await authenticate(request, reply, PATIENT_WRITE);
    if (!ctx) return undefined;
    const validation = validatePayload('coverageCreate', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Datos de cobertura inválidos', validation.errors);
    try {
      const patientId = request.params.id;
      if (!(await guardPatient(reply, patientId, ctx))) return undefined;
      const isPrimary = request.body.is_primary !== false;
      if (isPrimary) await unsetOtherPrimaries(patientId, null);
      const { data, error } = await supabase
        .from('patient_coverages')
        .insert([{ ...request.body, is_primary: isPrimary, patient_id: patientId, created_by: ctx.userId }])
        .select(COVERAGE_COLUMNS)
        .single();
      if (error) throw error;
      await audit({ actorId: ctx.userId, patientId, resourceType: 'coverage', resourceId: data.id, action: 'coverage_create', details: { payer_id: data.payer_id } });
      return reply.code(201).send(data);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /patients/:id/coverages');
    }
  });

  app.patch('/coverages/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, PATIENT_WRITE);
    if (!ctx) return undefined;
    const validation = validatePayload('coverageUpdate', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Datos de cobertura inválidos', validation.errors);
    try {
      const current = await one('patient_coverages', request.params.id);
      if (!current || !(await canAccessPatient(supabase, current.patient_id, ctx))) return sendError(reply, 404, 'Cobertura no encontrada');
      if (request.body.is_primary) await unsetOtherPrimaries(current.patient_id, current.id);
      const { data, error } = await supabase.from('patient_coverages').update(request.body).eq('id', current.id).select(COVERAGE_COLUMNS).single();
      if (error) throw error;
      await audit({ actorId: ctx.userId, patientId: current.patient_id, resourceType: 'coverage', resourceId: current.id, action: 'coverage_update', details: { updated_fields: Object.keys(request.body) } });
      return data;
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in PATCH /coverages/:id');
    }
  });

  // ------------------------------------------------------------- autorizaciones

  // GET /authorizations?status=&patient_id= - Tablero de autorizaciones dentro del alcance
  app.get('/authorizations', async (request, reply) => {
    const ctx = await authenticate(request, reply, ['coverage:manage', 'billing:read', 'patients:read']);
    if (!ctx) return undefined;
    try {
      const patientIds = request.query?.patient_id ? [request.query.patient_id] : await getAccessiblePatientIds(supabase, ctx);
      if (request.query?.patient_id && !(await guardPatient(reply, request.query.patient_id, ctx))) return undefined;
      if (patientIds && !patientIds.length) return [];

      let query = supabase.from('authorizations').select(AUTH_COLUMNS);
      if (patientIds) query = query.in('patient_id', patientIds);
      if (request.query?.status) query = query.eq('status', request.query.status);
      const { data, error } = await query.order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((row) => withExpiry(row));
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /authorizations');
    }
  });

  app.post('/patients/:id/authorizations', async (request, reply) => {
    const ctx = await authenticate(request, reply, PATIENT_WRITE);
    if (!ctx) return undefined;
    const validation = validatePayload('authorizationCreate', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Datos de la autorización inválidos', validation.errors);
    try {
      const patientId = request.params.id;
      if (!(await guardPatient(reply, patientId, ctx))) return undefined;

      let payerId = request.body.payer_id;
      if (request.body.coverage_id) {
        const coverage = await one('patient_coverages', request.body.coverage_id);
        if (coverage?.patient_id !== patientId) return sendError(reply, 400, 'La cobertura no pertenece a este paciente.');
        payerId = payerId || coverage.payer_id;
      }
      if (!payerId) return sendError(reply, 400, 'Indicá la obra social o la cobertura.');
      if (request.body.treatment_id) {
        const treatment = await one('treatments', request.body.treatment_id);
        if (treatment?.patient_id !== patientId) return sendError(reply, 400, 'El tratamiento no pertenece a este paciente.');
      }

      const { error: ruleError, changes } = applyAuthorizationChange(null, request.body);
      if (ruleError) return sendError(reply, 400, ruleError);

      const { data, error } = await supabase
        .from('authorizations')
        .insert([{ ...changes, payer_id: payerId, patient_id: patientId, created_by: ctx.userId }])
        .select(AUTH_COLUMNS)
        .single();
      if (error) throw error;
      await audit({ actorId: ctx.userId, patientId, resourceType: 'authorization', resourceId: data.id, action: 'authorization_create', details: { status: data.status, item: data.item } });
      return reply.code(201).send(withExpiry(data));
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /patients/:id/authorizations');
    }
  });

  app.patch('/authorizations/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, PATIENT_WRITE);
    if (!ctx) return undefined;
    const validation = validatePayload('authorizationUpdate', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Datos de la autorización inválidos', validation.errors);
    try {
      const current = await one('authorizations', request.params.id);
      if (!current || !(await canAccessPatient(supabase, current.patient_id, ctx))) return sendError(reply, 404, 'Autorización no encontrada');

      const { error: ruleError, changes } = applyAuthorizationChange(current, request.body);
      if (ruleError) return sendError(reply, 400, ruleError);

      const { data, error } = await supabase.from('authorizations').update(changes).eq('id', current.id).select(AUTH_COLUMNS).single();
      if (error) throw error;
      await audit({
        actorId: ctx.userId,
        patientId: current.patient_id,
        resourceType: 'authorization',
        resourceId: current.id,
        action: 'authorization_update',
        details: { from: current.status, to: data.status, number: data.authorization_number || null },
      });
      return withExpiry(data);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in PATCH /authorizations/:id');
    }
  });
}
