import { sendError, sendServerError, sendValidationError } from '../infra/errors.js';
import { validatePayload } from '../infra/validation.js';
import { canAccessPatient, getAccessiblePatientIds } from '../modules/shared/access.js';
import {
  normalizeSecretaryAppointment,
  listAppointments,
  listAppointmentsOnDate,
  findAppointmentById,
  createAppointment,
  updateAppointmentById,
  findConflicts,
  describeConflict,
  isWithinSchedule,
  computeFreeSlots,
  listProfessionals,
  listSchedules,
  replaceSchedules,
  buildNotificationDispatch,
} from '../modules/secretary/index.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function weekBounds(today = new Date()) {
  const day = today.getUTCDay() || 7;
  const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - day + 1));
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)];
}

export default async function appointmentsRoutes(app, { supabase, authenticate, audit }) {
  async function canAccessAppointment(appointment, ctx) {
    if (!appointment) return false;
    if (ctx.allPatients || appointment.professional_id === ctx.userId) return true;
    return canAccessPatient(supabase, appointment.patient_id, ctx);
  }

  async function patientRow(patientId) {
    const { data, error } = await supabase.from('patients').select('id, assigned_doctor_id').eq('id', patientId).maybeSingle();
    if (error) throw error;
    return data;
  }

  // Revisa choques. Devuelve true si ya respondió 409. (No devolver `reply`
  // desde una función async: Fastify lo trata como promesa y se pierde.)
  async function checkConflicts(reply, candidate, currentId, overbook) {
    const sameDay = await listAppointmentsOnDate(supabase, candidate.date);
    const conflicts = findConflicts(sameDay, candidate, currentId);

    if (conflicts.patient.length) {
      sendError(reply, 409, `El paciente ya tiene un turno que se superpone: ${describeConflict(conflicts.patient[0])}.`, { code: 'patient_conflict' });
      return true;
    }
    if (conflicts.resource.length) {
      sendError(reply, 409, `${candidate.resource} ya está ocupado: ${describeConflict(conflicts.resource[0])}.`, { code: 'resource_conflict' });
      return true;
    }
    if (conflicts.professional.length && !overbook) {
      sendError(reply, 409, `El profesional ya tiene un turno que se superpone: ${describeConflict(conflicts.professional[0])}. Podés darlo como sobreturno.`, { code: 'professional_conflict' });
      return true;
    }
    return false;
  }

  async function scheduleWarnings(candidate) {
    if (!candidate.professional_id) return [];
    const schedules = await listSchedules(supabase, candidate.professional_id);
    if (!schedules.length || isWithinSchedule(schedules, candidate)) return [];
    return ['El turno queda fuera del horario de atención del profesional.'];
  }

  // GET /professionals - Médicos activos para la agenda
  app.get('/professionals', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'appointments:read');
    if (!ctx) return undefined;
    try {
      return await listProfessionals(supabase);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /professionals');
    }
  });

  // GET /professionals/:id/schedule - Horario semanal de atención
  app.get('/professionals/:id/schedule', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'appointments:read');
    if (!ctx) return undefined;
    try {
      return await listSchedules(supabase, request.params.id);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /professionals/:id/schedule');
    }
  });

  // PUT /professionals/:id/schedule - Reemplaza el horario (el propio médico o administración)
  app.put('/professionals/:id/schedule', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'appointments:write');
    if (!ctx) return undefined;
    if (request.params.id !== ctx.userId && !ctx.can('users:manage')) {
      return sendError(reply, 403, 'Solo podés cambiar tu propio horario.');
    }

    const validation = validatePayload('scheduleReplace', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Horario inválido', validation.errors);
    const invalid = request.body.blocks.find((b) => b.end_time <= b.start_time);
    if (invalid) return sendError(reply, 400, 'Cada franja debe terminar después de empezar.');

    try {
      const schedules = await replaceSchedules(supabase, request.params.id, request.body.blocks);
      await audit({ actorId: ctx.userId, resourceType: 'schedule', resourceId: request.params.id, action: 'schedule_update', details: { blocks: request.body.blocks.length } });
      return schedules;
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in PUT /professionals/:id/schedule');
    }
  });

  // GET /agenda/free-slots?professional_id&date&duration
  app.get('/agenda/free-slots', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'appointments:read');
    if (!ctx) return undefined;
    const { professional_id: professionalId, date } = request.query || {};
    const duration = Number.parseInt(request.query?.duration, 10) || 30;
    if (!professionalId || !DATE.test(date || '')) return sendError(reply, 400, 'Indicá profesional y fecha (AAAA-MM-DD).');

    try {
      const [schedules, appointments] = await Promise.all([listSchedules(supabase, professionalId), listAppointmentsOnDate(supabase, date)]);
      const mine = appointments.filter((a) => a.professional_id === professionalId);
      return { date, slots: computeFreeSlots({ schedules, appointments: mine, date, duration }), hasSchedule: schedules.length > 0 };
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /agenda/free-slots');
    }
  });

  // GET /appointments?from&to&professional_id - Turnos dentro del alcance (por defecto, esta semana)
  app.get('/appointments', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'appointments:read');
    if (!ctx) return undefined;

    const [defaultFrom, defaultTo] = weekBounds();
    const from = DATE.test(request.query?.from || '') ? request.query.from : defaultFrom;
    const to = DATE.test(request.query?.to || '') ? request.query.to : defaultTo;

    try {
      const patientIds = await getAccessiblePatientIds(supabase, ctx);
      const rows = await listAppointments(supabase, {
        patientIds,
        professionalId: request.query?.professional_id || null,
        extraProfessionalId: ctx.allPatients ? null : ctx.userId,
        from,
        to,
      });
      return rows.map(normalizeSecretaryAppointment);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /appointments');
    }
  });

  // POST /appointments - Crear turno
  app.post('/appointments', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'appointments:write');
    if (!ctx) return undefined;

    const validation = validatePayload('appointmentCreate', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Datos del turno inválidos', validation.errors);
    const { overbook = false, ...body } = request.body;

    try {
      if (!(await canAccessPatient(supabase, body.patient_id, ctx))) {
        return sendError(reply, 403, 'No tienes permisos para dar turnos a este paciente');
      }

      const patient = await patientRow(body.patient_id);
      const candidate = {
        patient_id: body.patient_id,
        professional_id: body.professional_id || patient?.assigned_doctor_id || null,
        date: body.date,
        time: body.time,
        duration_minutes: body.duration_minutes || 30,
        kind: body.kind || 'consulta',
        resource: body.resource?.trim() || null,
        note: body.note || '',
        status: body.status || 'scheduled',
      };

      if (await checkConflicts(reply, candidate, null, overbook)) return undefined;

      const sameDay = await listAppointmentsOnDate(supabase, candidate.date);
      const isOverbook = findConflicts(sameDay, candidate).professional.length > 0;
      const warnings = await scheduleWarnings(candidate);

      const appointment = await createAppointment(supabase, { ...candidate, is_overbook: isOverbook, created_by: ctx.userId });

      await audit({
        actorId: ctx.userId,
        patientId: candidate.patient_id,
        resourceType: 'appointment',
        resourceId: appointment.id,
        action: 'appointment_create',
        details: { date: candidate.date, time: candidate.time, kind: candidate.kind, professional_id: candidate.professional_id, overbook: isOverbook },
      });

      return reply.code(201).send({ ...normalizeSecretaryAppointment(appointment), warnings });
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /appointments');
    }
  });

  // PATCH /appointments/:id - Actualizar turno
  app.patch('/appointments/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'appointments:write');
    if (!ctx) return undefined;

    const validation = validatePayload('appointmentUpdate', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Datos del turno inválidos', validation.errors);
    const { overbook = false, ...updates } = request.body;
    if ('resource' in updates) updates.resource = updates.resource?.trim() || null;

    try {
      const current = await findAppointmentById(supabase, request.params.id);
      if (!(await canAccessAppointment(current, ctx))) return sendError(reply, 404, 'Turno no encontrado');

      if (updates.patient_id && updates.patient_id !== current.patient_id && !(await canAccessPatient(supabase, updates.patient_id, ctx))) {
        return sendError(reply, 403, 'No tienes permisos para asignar el turno a ese paciente');
      }

      const candidate = { ...current, ...updates };
      const reschedules = ['date', 'time', 'duration_minutes', 'professional_id', 'resource', 'patient_id'].some((field) => field in updates);
      const reactivates = current.status === 'cancelled' && updates.status && updates.status !== 'cancelled';
      let warnings = [];

      if ((reschedules || reactivates) && candidate.status !== 'cancelled') {
        if (await checkConflicts(reply, candidate, current.id, overbook)) return undefined;
        const sameDay = await listAppointmentsOnDate(supabase, candidate.date);
        updates.is_overbook = findConflicts(sameDay, candidate, current.id).professional.length > 0;
        warnings = await scheduleWarnings(candidate);
      }

      const appointment = await updateAppointmentById(supabase, current.id, updates);
      await audit({
        actorId: ctx.userId,
        patientId: appointment.patient_id,
        resourceType: 'appointment',
        resourceId: appointment.id,
        action: 'appointment_update',
        details: { updated_fields: Object.keys(updates) },
      });

      return reply.code(200).send({ ...normalizeSecretaryAppointment(appointment), warnings });
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in PATCH /appointments/:id');
    }
  });

  // DELETE /appointments/:id - Eliminar turno (los turnos no son historia clínica)
  app.delete('/appointments/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'appointments:write');
    if (!ctx) return undefined;

    try {
      const current = await findAppointmentById(supabase, request.params.id);
      if (!(await canAccessAppointment(current, ctx))) return sendError(reply, 404, 'Turno no encontrado');

      const { data, error } = await supabase.from('appointments').delete().eq('id', current.id).select();
      if (error) throw error;

      await audit({
        actorId: ctx.userId,
        patientId: current.patient_id,
        resourceType: 'appointment',
        resourceId: current.id,
        action: 'appointment_delete',
        details: { date: current.date, time: current.time },
      });

      return reply.code(200).send({ message: 'Turno eliminado correctamente', deleted: data?.[0] || current });
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in DELETE /appointments/:id');
    }
  });

  // POST /secretary/notifications - Registra la notificación (sin canal de envío todavía)
  app.post('/secretary/notifications', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'notifications:send');
    if (!ctx) return undefined;

    const validation = validatePayload('secretaryNotification', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Payload inválido para notificación', validation.errors);

    try {
      const dispatch = buildNotificationDispatch(request.body);
      await audit({
        actorId: ctx.userId,
        resourceType: 'notification',
        action: 'secretary_notification_register',
        details: { channel: dispatch.channel, recipients_count: dispatch.recipients.length, status: dispatch.status },
      });
      return reply.code(200).send(dispatch);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /secretary/notifications');
    }
  });
}
