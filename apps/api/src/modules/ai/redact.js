// Anonimización de texto libre antes de enviarlo a Gemini (fuera del país).
// Reemplaza nombre del paciente, DNI, emails y teléfonos por marcadores.
// Es una capa de defensa adicional: el contexto estructurado ya no incluye
// nombre, DNI, contacto ni fecha de nacimiento.

const stripAccents = (value) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// 7 u 8 dígitos con o sin puntos: 30.111.222 / 30111222 / 5.123.456
const DNI_LIKE = /\b\d{1,2}\.?\d{3}\.?\d{3}\b/g;
const PHONE_LIKE = /\+?\(?\d[\d\s()-]{6,}\d/g;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function createRedactor(patient = {}) {
  const nameTokens = new Set(
    String(patient.full_name || '')
      .split(/[^\p{L}]+/u)
      .filter((token) => token.length >= 3)
      .map(stripAccents)
  );
  const literals = [patient.contact, patient.dni]
    .filter((value) => value && String(value).trim().length >= 4)
    .map((value) => String(value).trim());

  let count = 0;

  function redact(text) {
    if (text == null) return text;
    let out = String(text);

    for (const literal of literals) {
      const pattern = new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(pattern, () => { count += 1; return '[DATO PERSONAL]'; });
    }

    out = out.replace(EMAIL, () => { count += 1; return '[EMAIL]'; });

    out = out.replace(DNI_LIKE, () => { count += 1; return '[DNI]'; });

    out = out.replace(PHONE_LIKE, (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length < 8 || ISO_DATE.test(match.trim())) return match;
      count += 1;
      return '[TELÉFONO]';
    });

    if (nameTokens.size) {
      out = out.replace(/\p{L}+/gu, (word) => {
        if (!nameTokens.has(stripAccents(word))) return word;
        count += 1;
        return '[PACIENTE]';
      });
      out = out.replace(/\[PACIENTE\](?:\s+\[PACIENTE\])+/g, '[PACIENTE]');
    }

    return out;
  }

  return {
    redact,
    get count() {
      return count;
    },
  };
}

// Aplica el redactor a todos los textos libres del contexto clínico.
export function redactClinicalContext(patient, timeline, redactor) {
  const r = redactor.redact;
  return {
    patient: {
      ...patient,
      diagnosis_summary: r(patient.diagnosis_summary),
      tumors: (patient.tumors || []).map((t) => ({ ...t, site_detail: r(t.site_detail), notes: r(t.notes) })),
      treatments: (patient.treatments || []).map((t) => ({ ...t, notes: r(t.notes), suspension_reason: r(t.suspension_reason) })),
    },
    timeline: timeline.map((event) => ({ ...event, description: r(event.description), outcome_note: r(event.outcome_note) })),
  };
}
