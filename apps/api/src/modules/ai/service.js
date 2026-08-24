import { GoogleGenerativeAI } from '@google/generative-ai';

export function buildPatientContextBlock(patient, timeline = []) {
  const timelineText = timeline.length
    ? timeline
        .map((event) => `- ${event.event_date} | ${event.event_type}: ${event.description}${event.outcome_note ? ` (evolución: ${event.outcome_note})` : ''}`)
        .join('\n')
    : '- Sin eventos recientes cargados';

  return `
Paciente: ${patient.full_name || 'No especificado'}
Diagnóstico: ${patient.diagnosis_summary || 'No especificado'}
Estadio: ${patient.tumor_stage || 'No especificado'}
Localización: ${patient.tumor_location || 'No especificada'}
Marcadores moleculares: ${JSON.stringify(patient.molecular_markers || {})}
Eventos clínicos recientes:
${timelineText}
`.trim();
}

export function buildIngestPrompt({ patient, timeline, documentText, documentReference }) {
  return `
Eres un asistente de extracción clínica.
Analiza el documento provisto y devuelve un resumen estructurado en español.

CONTEXTO PACIENTE:
${buildPatientContextBlock(patient, timeline)}

REFERENCIA DE DOCUMENTO: ${documentReference || 'no provista'}

TEXTO DEL DOCUMENTO:
${documentText}

Responde en formato JSON con claves: resumen_clinico, hallazgos_clave, medicacion_mencionada, proximos_pasos_sugeridos, confidence.
`.trim();
}

export function buildRecommendationsPrompt({ patient, timeline, clinicalQuestion }) {
  return `
Eres un asistente oncológico basado en evidencia.
Genera recomendaciones terapéuticas preliminares y explícita supuestos.

CONTEXTO PACIENTE:
${buildPatientContextBlock(patient, timeline)}

PREGUNTA CLÍNICA:
${clinicalQuestion || 'Sugerir próximos pasos de manejo oncológico'}

Responde con: 1) Resumen del caso 2) Recomendaciones 3) Riesgos/alertas 4) Información faltante para decisión definitiva.
`.trim();
}

export function buildChatPrompt({ patient, timeline, message, history = [] }) {
  const historyText = history.length
    ? history.map((item) => `- ${item.role || 'user'}: ${item.content || ''}`).join('\n')
    : '- Sin historial previo';

  return `
Eres un asistente clínico conversacional.
Responde de forma breve, clara y segura, sin reemplazar criterio médico.

CONTEXTO PACIENTE:
${buildPatientContextBlock(patient, timeline)}

HISTORIAL DE CHAT:
${historyText}

MENSAJE ACTUAL:
${message}
`.trim();
}

export async function generateGeminiResponse({ apiKey, prompt, model = 'gemini-3-flash-preview' }) {
  if (!apiKey) {
    return {
      text: 'No se pudo consultar Gemini: GEMINI_API_KEY no configurada. Guarda el input para reprocesar luego.',
      model,
      provider: 'fallback',
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const aiModel = genAI.getGenerativeModel({ model });
  const result = await aiModel.generateContent(prompt);
  const response = await result.response;

  return {
    text: response.text(),
    model,
    provider: 'gemini',
  };
}
