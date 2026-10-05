import { sendError, sendServerError, sendValidationError } from '../infra/errors.js';
import { validatePayload } from '../infra/validation.js';
import { canAccessPatient, getAccessiblePatientIds } from '../modules/shared/access.js';
import {
  normalizeSecretaryAppointment,
  listAppointmentsByPatientIds,
  findAppointmentById,
  createAppointment,
  updateAppointmentById,
  hasScheduleConflict,
  buildNotificationDispatch,
} from '../modules/secretary/index.js';

export default async function appointmentsRoutes(app, { supabase, authenticate, audit }) {
  // GET /appointments - Turnos dentro del alcance del usuario
  app.get('/appointments', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'appointments:read');
    if (!ctx) return;

    try {
      const patientIds = await getAccessiblePatientIds(supabase, ctx);
      const rows = await listAppointmentsByPatientIds(supabase, patientIds);
      return rows.map(normalizeSecretaryAppointment);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /appointments');
    }
  });

  // POST /appointments - Crear turno
  app.post('/appointments', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'appointments:write');
    if (!ctx) return;

    const validation = validatePayload('appointmentCreate', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Payload inválido para crear turno', validation.errors);
    }
    const { patient_id, date, time, note, status } = request.body;

    try {
      if (!(await canAccessPatient(supabase, patient_id, ctx))) {
        return sendError(reply, 403, 'No tienes permisos para crear turnos para este paciente');
      }

      const patientAppointments = await listAppointmentsByPatientIds(supabase, [patient_id]);
      if (hasScheduleConflict(patientAppointments, { patient_id, date, time })) {
        return sendError(reply, 409, 'Conflicto de agenda: ya existe un turno para ese paciente en ese horario');
      }

      const appointment = await createAppointment(supabase, {
        patient_id,
        date,
        time,
        note: note || '',
        status: status || 'scheduled',
        created_by: ctx.userId,
      });

      await audit({
        actorId: ctx.userId,
        patientId: patient_id,
        resourceType: 'appointment',
        resourceId: appointment.id,
        action: 'appointment_create',
        details: { date: appointment.date, time: appointment.time, status: appointment.status },
      });

      return reply.code(201).send(normalizeSecretaryAppointment(appointment));
    } catch (err) {
      if (err?.code === '23514') {
        return sendError(reply, 400, 'Estado de turno inválido. Usá scheduled, confirmed, completed o cancelled.');
      }
      return sendServerError(request, reply, err, 'Exception in POST /appointments');
    }
  });

  // PATCH /appointments/:id - Actualizar turno
  app.patch('/appointments/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'appointments:write');
    if (!ctx) return;

    const { id } = request.params;
    const validation = validatePayload('appointmentUpdate', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Payload inválido para actualizar turno', validation.errors);
    }

    const { date, time, note, status, patient_id } = request.body;
    const updates = {};
    if (date !== undefined) updates.date = date;
    if (time !== undefined) updates.time = time;
    if (note !== undefined) updates.note = note;
    if (status !== undefined) updates.status = status;
    if (patient_id !== undefined) updates.patient_id = patient_id;

    try {
      const current = await findAppointmentById(supabase, id);
      if (!current || !(await canAccessPatient(supabase, current.patient_id, ctx))) {
        return sendError(reply, 404, 'Turno no encontrado');
      }

      const targetPatientId = patient_id || current.patient_id;
      if (targetPatientId !== current.patient_id && !(await canAccessPatient(supabase, targetPatientId, ctx))) {
        return sendError(reply, 403, 'No tienes permisos para asignar el turno a ese paciente');
      }

      const candidate = { patient_id: targetPatientId, date: date || current.date, time: time || current.time };
      const patientAppointments = await listAppointmentsByPatientIds(supabase, [targetPatientId]);
      if (hasScheduleConflict(patientAppointments, candidate, id)) {
        return sendError(reply, 409, 'Conflicto de agenda: ya existe un turno para ese paciente en ese horario');
      }

      const appointment = await updateAppointmentById(supabase, id, updates);
      await audit({
        actorId: ctx.userId,
        patientId: appointment.patient_id,
        resourceType: 'appointment',
        resourceId: appointment.id,
        action: 'appointment_update',
        details: { updated_fields: Object.keys(updates) },
      });

      return reply.code(200).send(normalizeSecretaryAppointment(appointment));
    } catch (err) {
      if (err?.code === '23514') {
        return sendError(reply, 400, 'Estado de turno inválido. Usá scheduled, confirmed, completed o cancelled.');
      }
      return sendServerError(request, reply, err, 'Exception in PATCH /appointments/:id');
    }
  });

  // DELETE /appointments/:id - Eliminar turno (los turnos no son historia clínica)
  app.delete('/appointments/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'appointments:write');
    if (!ctx) return;

    const { id } = request.params;

    try {
      const current = await findAppointmentById(supabase, id);
      if (!current || !(await canAccessPatient(supabase, current.patient_id, ctx))) {
        return sendError(reply, 404, 'Turno no encontrado');
      }

      const { data, error } = await supabase.from('appointments').delete().eq('id', id).select();
      if (error) throw error;
      if (!data?.length) {
        return sendError(reply, 404, 'Turno no encontrado');
      }

      await audit({
        actorId: ctx.userId,
        patientId: current.patient_id,
        resourceType: 'appointment',
        resourceId: id,
        action: 'appointment_delete',
        details: { date: current.date, time: current.time },
      });

      return reply.code(200).send({ message: 'Turno eliminado correctamente', deleted: data[0] });
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in DELETE /appointments/:id');
    }
  });

  // POST /secretary/notifications - Registra la notificación (sin canal de envío todavía)
  app.post('/secretary/notifications', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'notifications:send');
    if (!ctx) return;

    const validation = validatePayload('secretaryNotification', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Payload inválido para notificación', validation.errors);
    }

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
