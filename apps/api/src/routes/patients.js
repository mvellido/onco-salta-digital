import { sendError, sendServerError, sendValidationError } from '../infra/errors.js';
import { validatePayload } from '../infra/validation.js';
import { validatePatientFormatted } from '../validator.js';
import { canAccessPatient } from '../modules/shared/access.js';
import {
  listPatients,
  createPatient,
  getPatientById,
  isActiveDoctor,
  getPatientTimeline,
  getEventAttachmentCounts,
  updatePatientById,
  buildPatientInsertRow,
  buildPatientUpdatePayload,
  buildPatientDetailResponse,
  toBasicPatient,
} from '../modules/patients/index.js';

// Ruta de Storage compartida con la ficha del paciente y con las políticas RLS
// de storage.objects: patients/<patient_id>/...
export function buildPatientStoragePrefix(patientId) {
  return `patients/${patientId}`;
}

export default async function patientsRoutes(app, { supabase, authenticate, audit, storageBucket }) {
  // GET /patients - Ficha completa con patients:read; datos básicos con patients:read_basic.
  // ?archived=true lista solo los archivados.
  app.get('/patients', async (request, reply) => {
    const ctx = await authenticate(request, reply, ['patients:read', 'patients:read_basic']);
    if (!ctx) return;

    try {
      const patients = await listPatients(supabase, ctx, { archived: request.query?.archived === 'true' });
      return ctx.can('patients:read') ? patients : patients.map(toBasicPatient);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /patients');
    }
  });

  // POST /patients - Crear paciente (payload del esquema IA Core)
  app.post('/patients', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'patients:write');
    if (!ctx) return;

    const validation = validatePatientFormatted(request.body);
    if (!validation.isValid) {
      return sendError(reply, 400, 'Datos del paciente inválidos según el esquema IA Core', validation.errorsFormatted);
    }

    const meta = validatePayload('patientCreateMeta', request.body);
    if (!meta.ok) {
      return sendValidationError(reply, 'Médico asignado inválido', meta.errors);
    }

    try {
      // Un médico se asigna a sí mismo; quien ve todos los pacientes puede elegir el médico.
      let assignedDoctorId = ctx.userId;
      const requestedDoctorId = request.body.assigned_doctor_id;
      if (requestedDoctorId && requestedDoctorId !== ctx.userId) {
        if (!ctx.allPatients) {
          return sendError(reply, 403, 'Solo podés registrar pacientes a tu nombre.');
        }
        if (!(await isActiveDoctor(supabase, requestedDoctorId))) {
          return sendError(reply, 400, 'El médico asignado no existe o no está activo.');
        }
        assignedDoctorId = requestedDoctorId;
      } else if (ctx.role !== 'doctor') {
        return sendError(reply, 400, 'Indicá el médico responsable (assigned_doctor_id).');
      }

      const createdPatient = await createPatient(supabase, buildPatientInsertRow(request.body, assignedDoctorId));
      await audit({
        actorId: ctx.userId,
        patientId: createdPatient.id,
        resourceType: 'patient',
        resourceId: createdPatient.id,
        action: 'patient_create',
        details: { status: createdPatient.status, assigned_doctor_id: assignedDoctorId },
      });

      return reply.code(201).send({
        message: 'Paciente creado correctamente con validación IA Core',
        patient: createdPatient,
      });
    } catch (err) {
      if (err?.code === '23505') {
        return sendError(reply, 409, 'Ya existe un paciente con ese DNI.');
      }
      return sendServerError(request, reply, err, 'Exception in POST /patients');
    }
  });

  // GET /patients/:id - Ficha clínica con línea de tiempo
  app.get('/patients/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'patients:read');
    if (!ctx) return;

    const { id } = request.params;

    try {
      const patient = await getPatientById(supabase, id, ctx);
      if (!patient) {
        return sendError(reply, 404, 'Paciente no encontrado o sin permisos');
      }

      let timelineData = [];
      let attachmentCounts = {};

      try {
        timelineData = await getPatientTimeline(supabase, id);
        attachmentCounts = await getEventAttachmentCounts(supabase, timelineData.map((event) => event.id));
      } catch (timelineError) {
        request.log.warn({ err: timelineError }, 'No se pudo cargar timeline del paciente');
      }

      await audit({ actorId: ctx.userId, patientId: id, resourceType: 'patient', resourceId: id, action: 'patient_view' });

      return buildPatientDetailResponse(patient, timelineData, attachmentCounts);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /patients/:id');
    }
  });

  // PUT /patients/:id - Actualizar datos clínicos y generales
  app.put('/patients/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'patients:write');
    if (!ctx) return;

    const { id } = request.params;
    const validation = validatePayload('patientUpdate', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Payload inválido para actualizar paciente', validation.errors);
    }

    const updates = buildPatientUpdatePayload(request.body || {});
    if (!Object.keys(updates).length) {
      return sendError(reply, 400, 'No hay campos editables en el pedido.');
    }

    try {
      const updatedPatient = await updatePatientById(supabase, id, ctx, updates);
      if (!updatedPatient) {
        return sendError(reply, 404, 'Paciente no encontrado o sin permisos');
      }

      await audit({
        actorId: ctx.userId,
        patientId: updatedPatient.id,
        resourceType: 'patient',
        resourceId: updatedPatient.id,
        action: 'patient_update',
        details: { updated_fields: Object.keys(updates) },
      });

      return reply.code(200).send(updatedPatient);
    } catch (err) {
      if (err?.code === '23505') {
        return sendError(reply, 409, 'Ya existe un paciente con ese DNI.');
      }
      return sendServerError(request, reply, err, 'Exception in PUT /patients/:id');
    }
  });

  // POST /patients/:id/archive - Baja lógica; la historia clínica se conserva.
  app.post('/patients/:id/archive', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'patients:archive');
    if (!ctx) return;

    const { id } = request.params;
    const validation = validatePayload('patientArchive', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Indicá el motivo del archivo (mínimo 3 caracteres).', validation.errors);
    }

    try {
      const current = await getPatientById(supabase, id, ctx);
      if (!current) {
        return sendError(reply, 404, 'Paciente no encontrado o sin permisos');
      }
      if (current.archived_at) {
        return sendError(reply, 409, 'El paciente ya está archivado.');
      }

      const archived = await updatePatientById(supabase, id, ctx, {
        archived_at: new Date().toISOString(),
        archived_by: ctx.userId,
        archive_reason: request.body.reason.trim(),
      });

      await audit({
        actorId: ctx.userId,
        patientId: id,
        resourceType: 'patient',
        resourceId: id,
        action: 'patient_archive',
        details: { reason: archived.archive_reason },
      });

      return reply.code(200).send(archived);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /patients/:id/archive');
    }
  });

  // POST /patients/:id/restore - Reactivar un paciente archivado
  app.post('/patients/:id/restore', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'patients:archive');
    if (!ctx) return;

    const { id } = request.params;

    try {
      const current = await getPatientById(supabase, id, ctx);
      if (!current) {
        return sendError(reply, 404, 'Paciente no encontrado o sin permisos');
      }
      if (!current.archived_at) {
        return sendError(reply, 409, 'El paciente no está archivado.');
      }

      const restored = await updatePatientById(supabase, id, ctx, {
        archived_at: null,
        archived_by: null,
        archive_reason: null,
      });

      await audit({
        actorId: ctx.userId,
        patientId: id,
        resourceType: 'patient',
        resourceId: id,
        action: 'patient_restore',
        details: { previous_reason: current.archive_reason },
      });

      return reply.code(200).send(restored);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /patients/:id/restore');
    }
  });

  // DELETE /patients/:id - Ya no borra: la historia clínica debe conservarse.
  app.delete('/patients/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply);
    if (!ctx) return;

    return sendError(reply, 405, 'Los pacientes no se eliminan. Usá POST /patients/:id/archive con el motivo.');
  });

  // GET /patients/:id/documents - Listar documentos en Storage
  app.get('/patients/:id/documents', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'patients:read');
    if (!ctx) return;

    const { id } = request.params;

    try {
      if (!(await canAccessPatient(supabase, id, ctx))) {
        return sendError(reply, 403, 'No tienes permisos para listar documentos de este paciente');
      }

      const prefix = `${buildPatientStoragePrefix(id)}/uploads`;
      const { data, error } = await supabase.storage
        .from(storageBucket)
        .list(prefix, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });

      if (error) throw error;

      return reply.code(200).send({ bucket: storageBucket, prefix, documents: data || [] });
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /patients/:id/documents');
    }
  });

  // POST /patients/:id/documents/upload-url - URL de subida firmada
  app.post('/patients/:id/documents/upload-url', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'patients:write');
    if (!ctx) return;

    const { id } = request.params;
    const validation = validatePayload('documentUploadUrl', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Payload inválido para generación de URL de subida', validation.errors);
    }

    try {
      if (!(await canAccessPatient(supabase, id, ctx))) {
        return sendError(reply, 403, 'No tienes permisos para subir documentos a este paciente');
      }

      const safeName = request.body.fileName.replace(/[^\w.-]+/g, '-').toLowerCase();
      const path = `${buildPatientStoragePrefix(id)}/uploads/${Date.now()}-${safeName}`;

      const { data, error } = await supabase.storage.from(storageBucket).createSignedUploadUrl(path);
      if (error) throw error;

      await audit({
        actorId: ctx.userId,
        patientId: id,
        resourceType: 'document',
        action: 'document_upload_url_create',
        details: { path },
      });

      return reply.code(200).send({ bucket: storageBucket, path, signedUpload: data });
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /patients/:id/documents/upload-url');
    }
  });

  // DELETE /patients/:id/documents - Eliminar documento por path
  app.delete('/patients/:id/documents', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'patients:write');
    if (!ctx) return;

    const { id } = request.params;
    const validation = validatePayload('documentDelete', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Payload inválido para eliminar documento', validation.errors);
    }
    const { path } = request.body;

    try {
      if (!(await canAccessPatient(supabase, id, ctx))) {
        return sendError(reply, 403, 'No tienes permisos para eliminar documentos de este paciente');
      }

      if (!path.startsWith(`${buildPatientStoragePrefix(id)}/`) || path.includes('..')) {
        return sendError(reply, 403, 'Path fuera del alcance permitido para este paciente');
      }

      const { data, error } = await supabase.storage.from(storageBucket).remove([path]);
      if (error) throw error;

      await audit({
        actorId: ctx.userId,
        patientId: id,
        resourceType: 'document',
        action: 'document_delete',
        details: { path },
      });

      return reply.code(200).send({ message: 'Documento eliminado correctamente', removed: data || [] });
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in DELETE /patients/:id/documents');
    }
  });
}
