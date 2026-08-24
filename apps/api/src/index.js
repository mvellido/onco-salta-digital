import 'dotenv/config.js';
import Fastify from 'fastify';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import { validatePatientFormatted } from './validator.js';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { sendError, sendValidationError } from './infra/errors.js';
import { validatePayload } from './infra/validation.js';
import {
  listPatientsByDoctor,
  createPatientForDoctor,
  getPatientByIdForDoctor,
  getPatientTimeline,
  getEventAttachmentCounts,
  updatePatientByIdForDoctor,
  deletePatientByIdForDoctor,
  buildPatientUpdatePayload,
  buildPatientDetailResponse,
} from './modules/patients/index.js';
import {
  getPatientContextForAI,
  buildIngestPrompt,
  buildRecommendationsPrompt,
  buildChatPrompt,
  generateGeminiResponse,
} from './modules/ai/index.js';
import {
  listBillingRecordsForDoctor,
  createBillingRecord,
  buildBillingReport,
  runReconciliation,
} from './modules/billing/index.js';
import {
  normalizeSecretaryAppointment,
  listAppointmentsByPatientIds,
  findAppointmentById,
  createAppointment,
  updateAppointmentById,
  hasScheduleConflict,
  buildNotificationDispatch,
  getRolePermissionsMap,
  updateRolePermissions,
  normalizePermissionInput,
} from './modules/secretary/index.js';

// Cargar variables de .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

// Configuración de puerto
const port = Number(process.env.PORT || 3001);

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'medical-history';
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error(
    'Error: Variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY no están configuradas. En desarrollo, usa .env.local'
  );
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Crear cliente Supabase
const supabase = supabaseUrl && supabaseServiceRoleKey 
  ? createSupabaseClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

// Crear servidor Fastify
const fastify = Fastify({ logger: true });

// Habilitar CORS para todas las rutas
fastify.register(cors, {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin no permitido por CORS'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

fastify.register(helmet, {
  global: true,
  contentSecurityPolicy: false,
});

// Health check
fastify.get('/health', async () => ({ status: 'ok' }));

function extractBearerToken(request) {
  const authHeader = request.headers?.authorization || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return authHeader.slice(7).trim();
}

async function requireAuthenticatedUser(request, reply) {
  if (!supabase) {
    sendError(reply, 500, 'Supabase no está configurado');
    return null;
  }

  const token = extractBearerToken(request);
  if (!token) {
    sendError(reply, 401, 'No autenticado: falta token Bearer');
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    sendError(reply, 401, 'No autenticado: token inválido o expirado');
    return null;
  }

  return data.user;
}

async function canAccessPatient(patientId, doctorId) {
  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('assigned_doctor_id', doctorId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return !!data;
}

async function getDoctorPatientIds(doctorId) {
  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('assigned_doctor_id', doctorId);

  if (error) {
    throw error;
  }

  return (data || []).map((row) => row.id);
}

function normalizeAppointment(appointment) {
  return {
    ...appointment,
    patientId: appointment.patient_id,
    patientName: appointment.patient?.full_name || 'Paciente desconocido',
  };
}

let runtimeRolePermissions = getRolePermissionsMap();

function buildPatientStoragePrefix(doctorId, patientId) {
  return `${doctorId}/patient_${patientId}`;
}

async function recordAuditEvent({ actorId, patientId = null, action, details = {} }) {
  if (!actorId || !action) {
    return;
  }

  try {
    const { error } = await supabase.from('audit_logs').insert([
      {
        actor_id: actorId,
        patient_id: patientId,
        action,
        details,
      },
    ]);

    if (error) {
      fastify.log.warn({ err: error, action }, 'No se pudo registrar auditoría');
    }
  } catch (error) {
    fastify.log.warn({ err: error, action }, 'Excepción registrando auditoría');
  }
}

async function resolvePatientAIContext({ patientId, userId }) {
  return getPatientContextForAI(supabase, patientId, userId);
}

// GET /patients - Listar pacientes
fastify.get('/patients', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  try {
    return await listPatientsByDoctor(supabase, user.id);
  } catch (err) {
    fastify.log.error({ err }, 'Exception in GET /patients');
    return reply.code(500).send({ error: err.message });
  }
});

// POST /patients - Crear paciente
fastify.post('/patients', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  try {
    const validation = validatePatientFormatted(request.body);

    if (!validation.isValid) {
      return reply.code(400).send({
        error: 'Datos del paciente inválidos según el esquema IA Core',
        details: validation.errorsFormatted,
      });
    }

    const createdPatient = await createPatientForDoctor(supabase, user.id, request.body);
    await recordAuditEvent({
      actorId: user.id,
      patientId: createdPatient.id || null,
      action: 'patient_create',
      details: {
        full_name: createdPatient.full_name,
        status: createdPatient.status,
      },
    });

    return reply.code(201).send({
      message: 'Paciente creado correctamente con validación IA Core',
      patient: createdPatient,
    });
  } catch (err) {
    fastify.log.error({ err }, 'Exception in POST /patients');
    return reply.code(500).send({ error: err.message });
  }
});

// GET /patients/:id - Obtener paciente por ID
fastify.get('/patients/:id', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  const { id } = request.params;

  try {
    const patient = await getPatientByIdForDoctor(supabase, id, user.id);

    if (!patient) {
      return reply.code(404).send({ error: 'Paciente no encontrado o sin permisos' });
    }

    let timelineData = [];
    let attachmentCounts = {};

    try {
      timelineData = await getPatientTimeline(supabase, id);
      const eventIds = timelineData.map((event) => event.id);
      attachmentCounts = await getEventAttachmentCounts(supabase, eventIds);
    } catch (timelineError) {
      fastify.log.warn({ err: timelineError }, 'No se pudo cargar timeline del paciente');
    }

    return buildPatientDetailResponse(patient, timelineData, attachmentCounts);
  } catch (err) {
    fastify.log.error({ err }, 'Exception in GET /patients/:id');
    return reply.code(500).send({ error: err.message });
  }
});

// GET /patients/:id/documents - Listar documentos en storage del paciente
fastify.get('/patients/:id/documents', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  const { id } = request.params;

  try {
    const allowed = await canAccessPatient(id, user.id);
    if (!allowed) {
      return reply.code(403).send({ error: 'No tienes permisos para listar documentos de este paciente' });
    }

    const prefix = buildPatientStoragePrefix(user.id, id);
    const { data, error } = await supabase.storage
      .from(storageBucket)
      .list(prefix, {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      fastify.log.error({ err: error }, 'Error listing patient documents');
      return reply.code(500).send({ error: error.message });
    }

    return reply.code(200).send({
      bucket: storageBucket,
      prefix,
      documents: data || [],
    });
  } catch (err) {
    fastify.log.error({ err }, 'Exception in GET /patients/:id/documents');
    return reply.code(500).send({ error: err.message });
  }
});

// POST /patients/:id/documents/upload-url - Generar URL de subida firmada
fastify.post('/patients/:id/documents/upload-url', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  const { id } = request.params;
  const validation = validatePayload('documentUploadUrl', request.body);
  if (!validation.ok) {
    return sendValidationError(reply, 'Payload inválido para generación de URL de subida', validation.errors);
  }
  const { fileName } = request.body;

  try {
    const allowed = await canAccessPatient(id, user.id);
    if (!allowed) {
      return reply.code(403).send({ error: 'No tienes permisos para subir documentos a este paciente' });
    }

    const safeName = fileName.replace(/\s+/g, '-').toLowerCase();
    const prefix = buildPatientStoragePrefix(user.id, id);
    const path = `${prefix}/uploads/${Date.now()}-${safeName}`;

    const { data, error } = await supabase.storage
      .from(storageBucket)
      .createSignedUploadUrl(path);

    if (error) {
      fastify.log.error({ err: error }, 'Error creating signed upload URL');
      return reply.code(500).send({ error: error.message });
    }

    await recordAuditEvent({
      actorId: user.id,
      patientId: id,
      action: 'document_upload_url_create',
      details: { path, file_name: fileName },
    });

    return reply.code(200).send({
      bucket: storageBucket,
      path,
      signedUpload: data,
    });
  } catch (err) {
    fastify.log.error({ err }, 'Exception in POST /patients/:id/documents/upload-url');
    return reply.code(500).send({ error: err.message });
  }
});

// DELETE /patients/:id/documents - Eliminar documento por path
fastify.delete('/patients/:id/documents', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  const { id } = request.params;
  const validation = validatePayload('documentDelete', request.body);
  if (!validation.ok) {
    return sendValidationError(reply, 'Payload inválido para eliminar documento', validation.errors);
  }
  const { path } = request.body;

  try {
    const allowed = await canAccessPatient(id, user.id);
    if (!allowed) {
      return reply.code(403).send({ error: 'No tienes permisos para eliminar documentos de este paciente' });
    }

    const expectedPrefix = buildPatientStoragePrefix(user.id, id);
    if (!path.startsWith(expectedPrefix)) {
      return reply.code(403).send({ error: 'Path fuera del alcance permitido para este paciente' });
    }

    const { data, error } = await supabase.storage
      .from(storageBucket)
      .remove([path]);

    if (error) {
      fastify.log.error({ err: error }, 'Error deleting patient document');
      return reply.code(500).send({ error: error.message });
    }

    await recordAuditEvent({
      actorId: user.id,
      patientId: id,
      action: 'document_delete',
      details: { path },
    });

    return reply.code(200).send({
      message: 'Documento eliminado correctamente',
      removed: data || [],
    });
  } catch (err) {
    fastify.log.error({ err }, 'Exception in DELETE /patients/:id/documents');
    return reply.code(500).send({ error: err.message });
  }
});

// POST /ai/ingest - Ingesta de documento clínico y parsing asistido
fastify.post('/ai/ingest', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  try {
    const validation = validatePayload('aiIngest', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Payload inválido para ingesta IA', validation.errors);
    }

    const { patientId, rawText, documentReference } = request.body || {};
    const context = await resolvePatientAIContext({ patientId, userId: user.id });

    if (!context) {
      return reply.code(403).send({ error: 'No tienes permisos para ingerir documentos de este paciente' });
    }

    const extractedText = rawText || `Documento referenciado: ${documentReference}`;
    const prompt = buildIngestPrompt({
      patient: context.patient,
      timeline: context.timeline,
      documentText: extractedText,
      documentReference,
    });

    const ai = await generateGeminiResponse({
      apiKey: process.env.GEMINI_API_KEY,
      prompt,
    });

    await recordAuditEvent({
      actorId: user.id,
      patientId,
      action: 'ai_ingest',
      details: {
        document_reference: documentReference || null,
        source: rawText ? 'raw_text' : 'reference_only',
        model: ai.model,
      },
    });

    return reply.code(200).send({
      message: 'Documento procesado para ingesta IA',
      patientId,
      documentReference: documentReference || null,
      extractedTextPreview: extractedText.slice(0, 500),
      parsedSummary: ai.text,
      confidence: ai.provider === 'gemini' ? 'high' : 'low',
      provider: ai.provider,
      model: ai.model,
    });
  } catch (err) {
    fastify.log.error({ err }, 'Exception in POST /ai/ingest');
    return reply.code(500).send({ error: err.message });
  }
});

// POST /ai/recommendations - Recomendaciones terapéuticas contextualizadas
fastify.post('/ai/recommendations', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  try {
    const validation = validatePayload('aiRecommendations', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Payload inválido para recomendaciones IA', validation.errors);
    }

    const { patientId, clinicalQuestion } = request.body || {};
    const context = await resolvePatientAIContext({ patientId, userId: user.id });

    if (!context) {
      return reply.code(403).send({ error: 'No tienes permisos para consultar este paciente' });
    }

    const prompt = buildRecommendationsPrompt({
      patient: context.patient,
      timeline: context.timeline,
      clinicalQuestion,
    });

    const ai = await generateGeminiResponse({
      apiKey: process.env.GEMINI_API_KEY,
      prompt,
    });

    await recordAuditEvent({
      actorId: user.id,
      patientId,
      action: 'ai_recommendations',
      details: { clinicalQuestion: clinicalQuestion || null, model: ai.model },
    });

    return reply.code(200).send({
      message: 'Recomendaciones generadas',
      patientId,
      patient: context.patient.full_name,
      recommendations: ai.text,
      provider: ai.provider,
      model: ai.model,
      contextUsed: {
        timelineEvents: context.timeline.length,
      },
    });

  } catch (err) {
    fastify.log.error({ err }, 'Exception in POST /ai/recommendations');
    return reply.code(500).send({ error: err.message });
  }
});

// POST /ai/chat - Asistente conversacional con contexto del paciente
fastify.post('/ai/chat', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  try {
    const validation = validatePayload('aiChat', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Payload inválido para chat IA', validation.errors);
    }

    const { patientId, message, history = [] } = request.body || {};
    const context = await resolvePatientAIContext({ patientId, userId: user.id });

    if (!context) {
      return reply.code(403).send({ error: 'No tienes permisos para consultar este paciente' });
    }

    const prompt = buildChatPrompt({
      patient: context.patient,
      timeline: context.timeline,
      message,
      history,
    });

    const ai = await generateGeminiResponse({
      apiKey: process.env.GEMINI_API_KEY,
      prompt,
    });

    await recordAuditEvent({
      actorId: user.id,
      patientId,
      action: 'ai_chat',
      details: {
        message_preview: message.slice(0, 120),
        history_length: history.length,
        model: ai.model,
      },
    });

    return reply.code(200).send({
      message: 'Respuesta de chat generada',
      patientId,
      answer: ai.text,
      provider: ai.provider,
      model: ai.model,
    });
  } catch (err) {
    fastify.log.error({ err }, 'Exception in POST /ai/chat');
    return reply.code(500).send({ error: err.message });
  }
});

// POST /ia/consult - Alias legacy, redirigido a recomendaciones
fastify.post('/ia/consult', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  try {
    const validation = validatePayload('iaConsult', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Payload inválido para consulta IA', validation.errors);
    }

    const { patientId, patientData, question } = request.body || {};
    const targetPatientId = patientId || patientData?.id;
    const context = await resolvePatientAIContext({ patientId: targetPatientId, userId: user.id });

    if (!context) {
      return reply.code(403).send({ error: 'No tienes permisos para consultar este paciente' });
    }

    const prompt = buildRecommendationsPrompt({
      patient: context.patient,
      timeline: context.timeline,
      clinicalQuestion: question,
    });

    const ai = await generateGeminiResponse({
      apiKey: process.env.GEMINI_API_KEY,
      prompt,
    });

    await recordAuditEvent({
      actorId: user.id,
      patientId: targetPatientId,
      action: 'ia_consult',
      details: { question, model: ai.model },
    });

    return reply.code(200).send({
      message: 'IA Core - Compatibilidad legacy',
      patient: context.patient.full_name,
      question,
      answer: ai.text,
      provider: ai.provider,
      model: ai.model,
    });
  } catch (err) {
    fastify.log.error({ err }, 'Exception in POST /ia/consult');
    return reply.code(500).send({ error: err.message });
  }
});

// GET /billing/reports - Resumen financiero por usuario autenticado
fastify.get('/billing/reports', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  try {
    const records = await listBillingRecordsForDoctor(supabase, user.id);
    const report = buildBillingReport(records);

    return reply.code(200).send(report);
  } catch (err) {
    fastify.log.error({ err }, 'Exception in GET /billing/reports');
    return reply.code(500).send({ error: err.message });
  }
});

// POST /billing/records - Crea registro financiero asociado a paciente
fastify.post('/billing/records', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  const validation = validatePayload('billingCreate', request.body);
  if (!validation.ok) {
    return sendValidationError(reply, 'Payload inválido para registro financiero', validation.errors);
  }

  const payload = request.body || {};

  try {
    const allowed = await canAccessPatient(payload.patient_id, user.id);
    if (!allowed) {
      return reply.code(403).send({ error: 'No tienes permisos para registrar facturación de este paciente' });
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
      notes: payload.notes || null,
    });

    await recordAuditEvent({
      actorId: user.id,
      patientId: payload.patient_id,
      action: 'billing_record_create',
      details: {
        invoice_number: record.invoice_number,
        amount: record.amount,
        status: record.status,
      },
    });

    return reply.code(201).send(record);
  } catch (err) {
    fastify.log.error({ err }, 'Exception in POST /billing/records');
    return reply.code(500).send({ error: err.message });
  }
});

// POST /billing/conciliate - Motor de conciliación financiera
fastify.post('/billing/conciliate', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  const validation = validatePayload('billingConciliate', request.body);
  if (!validation.ok) {
    return sendValidationError(reply, 'Payload inválido para conciliación', validation.errors);
  }

  const { records, expectedTotal = null } = request.body || {};

  try {
    const result = runReconciliation(records, expectedTotal);

    await recordAuditEvent({
      actorId: user.id,
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
    fastify.log.error({ err }, 'Exception in POST /billing/conciliate');
    return reply.code(500).send({ error: err.message });
  }
});

// GET /appointments - Listar turnos con información de paciente
fastify.get('/appointments', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  try {
    const patientIds = await getDoctorPatientIds(user.id);
    if (patientIds.length === 0) {
      return [];
    }

    const rows = await listAppointmentsByPatientIds(supabase, patientIds);
    const appointments = rows.map(normalizeSecretaryAppointment);

    return appointments;
  } catch (err) {
    fastify.log.error({ err }, 'Exception in GET /appointments');
    return reply.code(500).send({ error: err.message });
  }
});

// POST /appointments - Crear turno
fastify.post('/appointments', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  const validation = validatePayload('appointmentCreate', request.body);
  if (!validation.ok) {
    return sendValidationError(reply, 'Payload inválido para crear turno', validation.errors);
  }
  const { patient_id, date, time, note, status } = request.body;

  try {
    const allowed = await canAccessPatient(patient_id, user.id);
    if (!allowed) {
      return reply.code(403).send({ error: 'No tienes permisos para crear turnos para este paciente' });
    }

    const patientAppointments = await listAppointmentsByPatientIds(supabase, [patient_id]);
    const hasConflict = hasScheduleConflict(patientAppointments, { patient_id, date, time });
    if (hasConflict) {
      return reply.code(409).send({ error: 'Conflicto de agenda: ya existe un turno para ese paciente en ese horario' });
    }

    const appointment = await createAppointment(supabase, {
      patient_id,
      date,
      time,
      note: note || '',
      status: status || 'scheduled',
    });

    await recordAuditEvent({
      actorId: user.id,
      patientId: appointment.patient_id || patient_id,
      action: 'appointment_create',
      details: {
        appointment_id: appointment.id,
        date: appointment.date,
        time: appointment.time,
        status: appointment.status,
      },
    });

    return reply.code(201).send(normalizeSecretaryAppointment(appointment));
  } catch (err) {
    fastify.log.error({ err }, 'Exception in POST /appointments');
    return reply.code(500).send({ error: err.message });
  }
});

// PATCH /appointments/:id - Actualizar turno
fastify.patch('/appointments/:id', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

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

    if (!current) {
      return reply.code(404).send({ error: 'Turno no encontrado' });
    }

    const targetPatientId = patient_id || current.patient_id;
    const allowed = await canAccessPatient(targetPatientId, user.id);
    if (!allowed) {
      return reply.code(403).send({ error: 'No tienes permisos para actualizar este turno' });
    }

    const candidate = {
      patient_id: targetPatientId,
      date: date || current.date,
      time: time || current.time,
    };

    const patientAppointments = await listAppointmentsByPatientIds(supabase, [targetPatientId]);
    const hasConflict = hasScheduleConflict(patientAppointments, candidate, id);
    if (hasConflict) {
      return reply.code(409).send({ error: 'Conflicto de agenda: ya existe un turno para ese paciente en ese horario' });
    }

    const appointment = await updateAppointmentById(supabase, id, updates);
    await recordAuditEvent({
      actorId: user.id,
      patientId: appointment.patient_id || targetPatientId,
      action: 'appointment_update',
      details: {
        appointment_id: appointment.id,
        updated_fields: Object.keys(updates),
      },
    });

    return reply.code(200).send(normalizeSecretaryAppointment(appointment));
  } catch (err) {
    fastify.log.error({ err }, 'Exception in PATCH /appointments/:id');
    return reply.code(500).send({ error: err.message });
  }
});

// DELETE /appointments/:id - Eliminar turno
fastify.delete('/appointments/:id', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  const { id } = request.params;

  try {
    const current = await findAppointmentById(supabase, id);

    if (!current) {
      return reply.code(404).send({ error: 'Turno no encontrado' });
    }

    const allowed = await canAccessPatient(current.patient_id, user.id);
    if (!allowed) {
      return reply.code(403).send({ error: 'No tienes permisos para eliminar este turno' });
    }

    const { data, error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      fastify.log.error({ err: error }, 'Error deleting appointment');
      return reply.code(500).send({ error: error.message });
    }

    if (!data || data.length === 0) {
      return reply.code(404).send({ error: 'Turno no encontrado' });
    }

    const deleted = data[0];
    await recordAuditEvent({
      actorId: user.id,
      patientId: deleted.patient_id || current.patient_id,
      action: 'appointment_delete',
      details: {
        appointment_id: deleted.id,
      },
    });

    return reply.code(200).send({
      message: 'Turno eliminado correctamente',
      deleted,
    });
  } catch (err) {
    fastify.log.error({ err }, 'Exception in DELETE /appointments/:id');
    return reply.code(500).send({ error: err.message });
  }
});

// POST /secretary/notifications - despacho de notificaciones administrativas
fastify.post('/secretary/notifications', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  const validation = validatePayload('secretaryNotification', request.body);
  if (!validation.ok) {
    return sendValidationError(reply, 'Payload inválido para notificación', validation.errors);
  }

  try {
    const dispatch = buildNotificationDispatch(request.body || {});

    await recordAuditEvent({
      actorId: user.id,
      action: 'secretary_notification_dispatch',
      details: {
        channel: dispatch.channel,
        recipients_count: dispatch.recipients.length,
        status: dispatch.status,
      },
    });

    return reply.code(200).send(dispatch);
  } catch (err) {
    fastify.log.error({ err }, 'Exception in POST /secretary/notifications');
    return reply.code(500).send({ error: err.message });
  }
});

// GET /secretary/permissions - mapa vigente de permisos por rol
fastify.get('/secretary/permissions', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  return reply.code(200).send({ roles: runtimeRolePermissions });
});

// PATCH /secretary/permissions - actualización administrativa de permisos en runtime
fastify.patch('/secretary/permissions', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  const validation = validatePayload('secretaryPermissionUpdate', request.body);
  if (!validation.ok) {
    return sendValidationError(reply, 'Payload inválido para permisos', validation.errors);
  }

  const payload = normalizePermissionInput(request.body || {});
  runtimeRolePermissions = updateRolePermissions(runtimeRolePermissions, payload.role, payload.permissions);

  await recordAuditEvent({
    actorId: user.id,
    action: 'secretary_permissions_update',
    details: {
      role: payload.role,
      permissions_count: payload.permissions.length,
    },
  });

  return reply.code(200).send({
    role: payload.role,
    permissions: runtimeRolePermissions[payload.role] || [],
    roles: runtimeRolePermissions,
  });
});

// PUT /patients/:id - Actualizar paciente
fastify.put('/patients/:id', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  const { id } = request.params;
  const validation = validatePayload('patientUpdate', request.body);
  if (!validation.ok) {
    return sendValidationError(reply, 'Payload inválido para actualizar paciente', validation.errors);
  }

  const updates = buildPatientUpdatePayload(request.body || {});

  try {
    const updatedPatient = await updatePatientByIdForDoctor(supabase, id, user.id, updates);

    if (!updatedPatient) {
      return reply.code(404).send({ error: 'Paciente no encontrado o sin permisos' });
    }

    const updatedFields = Object.keys(updates).filter((field) => updates[field] !== undefined);
    await recordAuditEvent({
      actorId: user.id,
      patientId: updatedPatient.id,
      action: 'patient_update',
      details: {
        updated_fields: updatedFields,
      },
    });

    return reply.code(200).send(updatedPatient);
  } catch (err) {
    fastify.log.error({ err }, 'Exception in PUT /patients/:id');
    return reply.code(500).send({ error: err.message });
  }
});

// DELETE /patients/:id - Eliminar paciente
fastify.delete('/patients/:id', async (request, reply) => {
  const user = await requireAuthenticatedUser(request, reply);
  if (!user) return;

  const { id } = request.params;

  try {
    const deletedPatient = await deletePatientByIdForDoctor(supabase, id, user.id);

    if (!deletedPatient) {
      return reply.code(404).send({ error: 'Paciente no encontrado o sin permisos' });
    }

    await recordAuditEvent({
      actorId: user.id,
      patientId: deletedPatient.id,
      action: 'patient_delete',
      details: {
        full_name: deletedPatient.full_name,
      },
    });

    return reply.code(200).send({ 
      message: 'Paciente eliminado correctamente',
      deleted: deletedPatient
    });
  } catch (err) {
    fastify.log.error({ err }, 'Exception in DELETE /patients/:id');
    return reply.code(500).send({ error: err.message });
  }
});

// Iniciar servidor
fastify.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`API listening on http://0.0.0.0:${port}`);
  console.log(`Health check: GET http://0.0.0.0:${port}/health`);
});
