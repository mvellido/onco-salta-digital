import { GoogleGenerativeAI } from '@google/generative-ai';

export function buildPatientContextBlock(patient, timeline = []) {
  const timelineText = timeline.length
    ? timeline
        .map((event) => `- ${event.event_date} | ${event.event_type}: ${event.description}${event.outcome_note ? ` (evolución: ${event.outcome_note})` : ''}`)
        .join('\n')
    : '- Sin eventos recientes cargados';

  const tumorsText = (patient.tumors || []).length
    ? patient.tumors.map(formatTumorLine).join('\n')
    : '- Sin tumores cargados';

  const treatmentsText = (patient.treatments || []).length
    ? patient.treatments.map(formatTreatmentLine).join('\n')
    : '- Sin tratamientos cargados';

  // Sin nombre, DNI, contacto ni fecha de nacimiento: el contexto sale del país hacia Gemini.
  return `
Edad: ${ageFromBirthDate(patient.birth_date) ?? 'No especificada'}
Sexo: ${patient.gender || 'No especificado'}
ECOG: ${patient.ecog ?? 'No registrado'}
Alergias: ${(patient.allergies || []).join(', ') || 'Ninguna registrada'}
Diagnóstico: ${patient.diagnosis_summary || 'No especificado'}
Tumores:
${tumorsText}
Tratamientos:
${treatmentsText}
Eventos clínicos recientes:
${timelineText}
`.trim();
}

export function ageFromBirthDate(birthDate, today = new Date()) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function formatTumorLine(tumor) {
  const tnm = [tumor.t_category, tumor.n_category, tumor.m_category].filter(Boolean).join(' ');
  const parts = [
    `${tumor.primary_site}${tumor.laterality && tumor.laterality !== 'na' ? ` (${tumor.laterality})` : ''}`,
    tumor.site_detail,
    tumor.histology,
    tumor.size_mm ? `${tumor.size_mm} mm` : null,
    tnm ? `${tumor.tnm_prefix || 'c'}${tnm}` : null,
    tumor.stage_group ? `estadio ${tumor.stage_group}` : null,
    tumor.status,
  ].filter(Boolean);
  const markers = (tumor.biomarkers || []).map((b) => `${b.name} ${b.result}`).join(', ');
  return `- ${parts.join(' · ')}${markers ? ` · biomarcadores: ${markers}` : ''}`;
}

function formatTreatmentLine(treatment) {
  const cycles = treatment.cycles_planned ? ` · ciclos ${treatment.cycles_done}/${treatment.cycles_planned}` : '';
  return `- ${treatment.kind}: ${treatment.regimen}${treatment.intent ? ` (${treatment.intent})` : ''} · ${treatment.status}${cycles}${treatment.start_date ? ` · desde ${treatment.start_date}` : ''}`;
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
