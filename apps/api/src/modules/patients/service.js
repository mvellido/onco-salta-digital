// Traduce el payload del esquema IA Core (specs/001-onco-salta-digital/patient-schema.json)
// a una fila de la tabla patients.
export function buildPatientInsertRow(payload = {}, assignedDoctorId) {
  const datosGenerales = payload.datos_generales || {};
  const historiaTumoral = payload.historia_tumoral || {};

  return {
    full_name: datosGenerales.nombre_completo,
    dni: datosGenerales.dni || null,
    birth_date: datosGenerales.fecha_nacimiento || null,
    gender: datosGenerales.sexo || 'No especificado',
    contact: datosGenerales.contacto || null,
    // Ubicación, estadio y marcadores se cargan como tumor estructurado en la ficha.
    diagnosis_summary: historiaTumoral.diagnostico_resumen || '',
    assigned_doctor_id: assignedDoctorId,
  };
}

const UPDATABLE_FIELDS = [
  'full_name',
  'diagnosis_summary',
  'status',
  'dni',
  'birth_date',
  'gender',
  'contact',
  'ecog',
  'allergies',
];

// Solo campos clínicos editables; assigned_doctor_id y los de archivo tienen endpoints propios.
export function buildPatientUpdatePayload(body = {}) {
  const updates = Object.fromEntries(
    UPDATABLE_FIELDS.filter((field) => body[field] !== undefined).map((field) => [field, body[field]])
  );

  if ('ecog' in updates) {
    updates.ecog_updated_at = new Date().toISOString();
  }
  if (Array.isArray(updates.allergies)) {
    updates.allergies = [...new Set(updates.allergies.map((item) => String(item).trim()).filter(Boolean))];
  }

  return updates;
}

export function buildPatientDetailResponse(patient, timeline = [], attachmentCounts = {}, clinical = {}) {
  return {
    ...patient,
    tumors: clinical.tumors || [],
    treatments: clinical.treatments || [],
    timeline: timeline.map((event) => ({
      ...event,
      attachments_count: attachmentCounts[event.id] || 0,
    })),
  };
}
