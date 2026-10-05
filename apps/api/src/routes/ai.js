import { sendError, sendServerError, sendValidationError } from '../infra/errors.js';
import { validatePayload } from '../infra/validation.js';
import { PRIMARY_SITES } from '../modules/clinical/catalog.js';
import {
  getPatientContextForAI,
  buildIngestPrompt,
  buildRecommendationsPrompt,
  buildChatPrompt,
  buildDocumentReadPrompt,
  createRedactor,
  redactClinicalContext,
  saveInteraction,
  listInteractions,
  findAttachmentForPatient,
  saveExtraction,
  listExtractions,
  parseJsonResponse,
  GEMINI_MISSING_TEXT,
} from '../modules/ai/index.js';
import { sanitizeExtraction } from '../modules/ai/extraction.js';
import {
  retrieveGuidance,
  formatSourcesForPrompt,
  citedSources,
  buildRetrievalQuery,
  extractPdfPages,
  looksScanned,
} from '../modules/guidelines/index.js';

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_DOCUMENT_CHARS = 60000;

export default async function aiRoutes(app, { supabase, authenticate, audit, gemini, storageBucket }) {
  // Usuario con ai:use y acceso a la ficha completa del paciente.
  async function guard(request, reply, patientId) {
    const ctx = await authenticate(request, reply, ['ai:use']);
    if (!ctx) return null;

    if (!ctx.can('patients:read')) {
      sendError(reply, 403, 'La IA clínica requiere acceso a la ficha completa del paciente.');
      return null;
    }

    const context = await getPatientContextForAI(supabase, patientId, ctx);
    if (!context) {
      sendError(reply, 403, 'No tienes permisos para consultar este paciente');
      return null;
    }

    return { ctx, context };
  }

  async function sourcesFor(request, query) {
    try {
      return await retrieveGuidance({ supabase, gemini, query });
    } catch (err) {
      request.log.warn({ err }, 'No se pudo consultar la biblioteca de guías');
      return [];
    }
  }

  // Consulta común a chat y recomendaciones: anonimiza, busca en guías, cita y guarda.
  async function consult(request, reply, { kind, schemaName, schemaMessage }) {
    const validation = validatePayload(schemaName, request.body);
    if (!validation.ok) return sendValidationError(reply, schemaMessage, validation.errors);

    const patientId = request.body.patientId || request.body.patientData?.id;
    const guarded = await guard(request, reply, patientId);
    if (!guarded) return undefined;
    const { ctx, context } = guarded;

    const question = (kind === 'chat' ? request.body.message : request.body.clinicalQuestion ?? request.body.question) || 'Sugerir próximos pasos de manejo oncológico';

    if (!gemini) {
      return reply.code(200).send({ answer: GEMINI_MISSING_TEXT, recommendations: GEMINI_MISSING_TEXT, sources: [], provider: 'fallback', model: null });
    }

    const redactor = createRedactor(context.patient);
    const safe = redactClinicalContext(context.patient, context.timeline, redactor);
    const safeQuestion = redactor.redact(question);
    const history = (request.body.history || []).slice(-10).map((item) => ({ role: item.role, content: redactor.redact(item.content || '') }));

    const sources = await sourcesFor(request, buildRetrievalQuery({ question: safeQuestion, patient: safe.patient }));
    const sourcesText = formatSourcesForPrompt(sources);

    const prompt = kind === 'chat'
      ? buildChatPrompt({ patient: safe.patient, timeline: safe.timeline, message: safeQuestion, history, sourcesText })
      : buildRecommendationsPrompt({ patient: safe.patient, timeline: safe.timeline, clinicalQuestion: safeQuestion, sourcesText });

    const answer = await gemini.generate(prompt);
    const used = citedSources(answer, sources);

    const interaction = await saveInteraction(supabase, {
      patient_id: patientId,
      actor_id: ctx.userId,
      kind,
      question,
      answer,
      sources: used,
      model: gemini.model,
      provider: 'gemini',
      redactions: redactor.count,
    });

    await audit({
      actorId: ctx.userId,
      patientId,
      resourceType: 'ai',
      resourceId: interaction.id,
      action: kind === 'chat' ? 'ai_chat' : 'ai_recommendations',
      details: { model: gemini.model, sources: used.length, redactions: redactor.count },
    });

    return reply.code(200).send({
      interactionId: interaction.id,
      answer,
      recommendations: answer,
      sources: used,
      guidelinesSearched: sources.length,
      redactions: redactor.count,
      provider: 'gemini',
      model: gemini.model,
    });
  }

  app.post('/ai/recommendations', (request, reply) =>
    consult(request, reply, { kind: 'recommendations', schemaName: 'aiRecommendations', schemaMessage: 'Payload inválido para recomendaciones IA' })
      .catch((err) => sendServerError(request, reply, err, 'Exception in POST /ai/recommendations')));

  app.post('/ai/chat', (request, reply) =>
    consult(request, reply, { kind: 'chat', schemaName: 'aiChat', schemaMessage: 'Payload inválido para chat IA' })
      .catch((err) => sendServerError(request, reply, err, 'Exception in POST /ai/chat')));

  // Alias legacy
  app.post('/ia/consult', (request, reply) =>
    consult(request, reply, { kind: 'recommendations', schemaName: 'iaConsult', schemaMessage: 'Payload inválido para consulta IA' })
      .catch((err) => sendServerError(request, reply, err, 'Exception in POST /ia/consult')));

  // POST /ai/ingest - Texto pegado o referencia de documento (sección IA)
  app.post('/ai/ingest', async (request, reply) => {
    try {
      const validation = validatePayload('aiIngest', request.body);
      if (!validation.ok) return sendValidationError(reply, 'Payload inválido para ingesta IA', validation.errors);

      const { patientId, rawText, documentReference } = request.body;
      const guarded = await guard(request, reply, patientId);
      if (!guarded) return undefined;
      const { ctx, context } = guarded;

      if (!gemini) return reply.code(200).send({ parsedSummary: GEMINI_MISSING_TEXT, provider: 'fallback' });

      const redactor = createRedactor(context.patient);
      const safe = redactClinicalContext(context.patient, context.timeline, redactor);
      const documentText = redactor.redact(rawText || `Documento referenciado: ${documentReference}`);
      const answer = await gemini.generate(buildIngestPrompt({ patient: safe.patient, timeline: safe.timeline, documentText, documentReference }));

      await saveInteraction(supabase, {
        patient_id: patientId,
        actor_id: ctx.userId,
        kind: 'ingest',
        question: documentReference || 'Texto pegado',
        answer,
        model: gemini.model,
        provider: 'gemini',
        redactions: redactor.count,
      });
      await audit({ actorId: ctx.userId, patientId, resourceType: 'ai', action: 'ai_ingest', details: { model: gemini.model, redactions: redactor.count } });

      return reply.code(200).send({ parsedSummary: answer, redactions: redactor.count, provider: 'gemini', model: gemini.model });
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /ai/ingest');
    }
  });

  // POST /patients/:id/attachments/:attachmentId/read - Lee un estudio adjunto.
  // PDF con texto: se extrae y anonimiza localmente. Imagen o PDF escaneado: el
  // archivo completo va a Gemini, por eso exige consentimiento explícito.
  app.post('/patients/:id/attachments/:attachmentId/read', async (request, reply) => {
    try {
      const { id: patientId, attachmentId } = request.params;
      const guarded = await guard(request, reply, patientId);
      if (!guarded) return undefined;
      const { ctx, context } = guarded;

      if (!gemini) return sendError(reply, 503, GEMINI_MISSING_TEXT);

      const attachment = await findAttachmentForPatient(supabase, attachmentId, patientId);
      if (!attachment) return sendError(reply, 404, 'Adjunto no encontrado');

      const contentType = attachment.content_type || '';
      const isPdf = contentType === 'application/pdf' || /\.pdf$/i.test(attachment.file_name);
      const isImage = contentType.startsWith('image/');
      if (!isPdf && !isImage) return sendError(reply, 415, 'Solo se pueden leer PDF o imágenes.');

      const { data: blob, error: downloadError } = await supabase.storage.from(storageBucket).download(attachment.storage_path);
      if (downloadError) throw downloadError;
      const buffer = Buffer.from(await blob.arrayBuffer());
      if (buffer.length > MAX_FILE_BYTES) return sendError(reply, 413, 'El archivo supera los 15 MB que admite la lectura con IA.');

      const redactor = createRedactor(context.patient);
      let method = 'image';
      let documentText = null;

      if (isPdf) {
        const pages = await extractPdfPages(buffer);
        if (!looksScanned(pages)) {
          method = 'pdf_text';
          documentText = redactor.redact(pages.map((page, i) => `--- Página ${i + 1} ---\n${page}`).join('\n\n')).slice(0, MAX_DOCUMENT_CHARS);
        }
      }

      if (method === 'image' && request.body?.allowFileUpload !== true) {
        return reply.code(409).send({
          error: isPdf
            ? 'El PDF está escaneado: para leerlo hay que enviar el archivo completo a Gemini, incluidos los datos personales que contenga.'
            : 'Para leer una imagen hay que enviarla completa a Gemini, incluidos los datos personales que contenga.',
          code: 'needs_consent',
        });
      }

      const parts = method === 'image'
        ? [{ inlineData: { mimeType: isPdf ? 'application/pdf' : contentType, data: buffer.toString('base64') } }]
        : [];
      const raw = await gemini.generate(buildDocumentReadPrompt({ documentText, sites: PRIMARY_SITES }), { json: true, parts });
      const parsed = parseJsonResponse(raw);
      if (!parsed) return sendError(reply, 502, 'La IA no devolvió un resultado legible. Probá de nuevo.');

      const extracted = sanitizeExtraction(parsed);
      const saved = await saveExtraction(supabase, {
        patient_id: patientId,
        attachment_id: attachment.id,
        method,
        summary: extracted.summary,
        extracted,
        redactions: redactor.count,
        model: gemini.model,
        created_by: ctx.userId,
      });

      await audit({
        actorId: ctx.userId,
        patientId,
        resourceType: 'document_extraction',
        resourceId: saved.id,
        action: 'ai_document_read',
        details: { attachment_id: attachment.id, method, model: gemini.model, redactions: redactor.count, file_sent: method === 'image' },
      });

      return reply.code(200).send(saved);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /patients/:id/attachments/:attachmentId/read');
    }
  });

  // GET /patients/:id/ai-history - Consultas previas a la IA sobre el paciente
  app.get('/patients/:id/ai-history', async (request, reply) => {
    try {
      const guarded = await guard(request, reply, request.params.id);
      if (!guarded) return undefined;
      return await listInteractions(supabase, request.params.id);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /patients/:id/ai-history');
    }
  });

  // GET /patients/:id/extractions - Lecturas de documentos ya hechas
  app.get('/patients/:id/extractions', async (request, reply) => {
    try {
      const guarded = await guard(request, reply, request.params.id);
      if (!guarded) return undefined;
      return await listExtractions(supabase, request.params.id);
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /patients/:id/extractions');
    }
  });
}
