import { sendError, sendServerError, sendValidationError } from '../infra/errors.js';
import { validatePayload } from '../infra/validation.js';
import {
  getPatientContextForAI,
  buildIngestPrompt,
  buildRecommendationsPrompt,
  buildChatPrompt,
  generateGeminiResponse,
} from '../modules/ai/index.js';

export default async function aiRoutes(app, { supabase, authenticate, audit, geminiApiKey }) {
  async function resolveContext(request, reply, schemaName, schemaMessage, patientIdOf) {
    const ctx = await authenticate(request, reply, ['ai:use']);
    if (!ctx) return null;

    if (!ctx.can('patients:read')) {
      sendError(reply, 403, 'La IA clínica requiere acceso a la ficha completa del paciente.');
      return null;
    }

    const validation = validatePayload(schemaName, request.body);
    if (!validation.ok) {
      sendValidationError(reply, schemaMessage, validation.errors);
      return null;
    }

    const patientId = patientIdOf(request.body);
    const context = await getPatientContextForAI(supabase, patientId, ctx);
    if (!context) {
      sendError(reply, 403, 'No tienes permisos para consultar este paciente');
      return null;
    }

    return { ctx, patientId, context };
  }

  // POST /ai/ingest - Ingesta de documento clínico y parsing asistido
  app.post('/ai/ingest', async (request, reply) => {
    try {
      const resolved = await resolveContext(request, reply, 'aiIngest', 'Payload inválido para ingesta IA', (body) => body.patientId);
      if (!resolved) return;
      const { ctx, patientId, context } = resolved;

      const { rawText, documentReference } = request.body;
      const extractedText = rawText || `Documento referenciado: ${documentReference}`;
      const ai = await generateGeminiResponse({
        apiKey: geminiApiKey,
        prompt: buildIngestPrompt({
          patient: context.patient,
          timeline: context.timeline,
          documentText: extractedText,
          documentReference,
        }),
      });

      await audit({
        actorId: ctx.userId,
        patientId,
        resourceType: 'ai',
        action: 'ai_ingest',
        details: { document_reference: documentReference || null, source: rawText ? 'raw_text' : 'reference_only', model: ai.model },
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
      return sendServerError(request, reply, err, 'Exception in POST /ai/ingest');
    }
  });

  // POST /ai/recommendations - Recomendaciones terapéuticas contextualizadas
  app.post('/ai/recommendations', async (request, reply) => {
    try {
      const resolved = await resolveContext(request, reply, 'aiRecommendations', 'Payload inválido para recomendaciones IA', (body) => body.patientId);
      if (!resolved) return;
      const { ctx, patientId, context } = resolved;

      const { clinicalQuestion } = request.body;
      const ai = await generateGeminiResponse({
        apiKey: geminiApiKey,
        prompt: buildRecommendationsPrompt({ patient: context.patient, timeline: context.timeline, clinicalQuestion }),
      });

      await audit({
        actorId: ctx.userId,
        patientId,
        resourceType: 'ai',
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
        contextUsed: { timelineEvents: context.timeline.length },
      });
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /ai/recommendations');
    }
  });

  // POST /ai/chat - Asistente conversacional con contexto del paciente
  app.post('/ai/chat', async (request, reply) => {
    try {
      const resolved = await resolveContext(request, reply, 'aiChat', 'Payload inválido para chat IA', (body) => body.patientId);
      if (!resolved) return;
      const { ctx, patientId, context } = resolved;

      const { message, history = [] } = request.body;
      const ai = await generateGeminiResponse({
        apiKey: geminiApiKey,
        prompt: buildChatPrompt({ patient: context.patient, timeline: context.timeline, message, history }),
      });

      await audit({
        actorId: ctx.userId,
        patientId,
        resourceType: 'ai',
        action: 'ai_chat',
        details: { message_preview: message.slice(0, 120), history_length: history.length, model: ai.model },
      });

      return reply.code(200).send({
        message: 'Respuesta de chat generada',
        patientId,
        answer: ai.text,
        provider: ai.provider,
        model: ai.model,
      });
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /ai/chat');
    }
  });

  // POST /ia/consult - Alias legacy de /ai/recommendations
  app.post('/ia/consult', async (request, reply) => {
    try {
      const resolved = await resolveContext(request, reply, 'iaConsult', 'Payload inválido para consulta IA', (body) => body.patientId || body.patientData?.id);
      if (!resolved) return;
      const { ctx, patientId, context } = resolved;

      const { question } = request.body;
      const ai = await generateGeminiResponse({
        apiKey: geminiApiKey,
        prompt: buildRecommendationsPrompt({ patient: context.patient, timeline: context.timeline, clinicalQuestion: question }),
      });

      await audit({
        actorId: ctx.userId,
        patientId,
        resourceType: 'ai',
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
      return sendServerError(request, reply, err, 'Exception in POST /ia/consult');
    }
  });
}
