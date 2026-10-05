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
    diagnosis_summary: historiaTumoral.diagnostico_resumen || '',
    tumor_location: historiaTumoral.ubicacion || null,
    tumor_stage: historiaTumoral.estadio || null,
    molecular_markers: historiaTumoral.marcadores_moleculares || {},
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
  'tumor_location',
  'tumor_stage',
  'molecular_markers',
];

// Solo campos clínicos editables; assigned_doctor_id y los de archivo tienen endpoints propios.
export function buildPatientUpdatePayload(body = {}) {
  return Object.fromEntries(
    UPDATABLE_FIELDS.filter((field) => body[field] !== undefined).map((field) => [field, body[field]])
  );
}

export function buildPatientDetailResponse(patient, timeline = [], attachmentCounts = {}) {
  return {
    ...patient,
    timeline: timeline.map((event) => ({
      ...event,
      attachments_count: attachmentCounts[event.id] || 0,
    })),
  };
}
