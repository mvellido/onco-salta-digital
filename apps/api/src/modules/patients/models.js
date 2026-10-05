export function normalizePatientRow(row = {}) {
  return {
    id: row.id,
    full_name: row.full_name || '',
    dni: row.dni || null,
    birth_date: row.birth_date || null,
    gender: row.gender || 'No especificado',
    contact: row.contact || null,
    diagnosis_summary: row.diagnosis_summary || '',
    status: row.status || 'active',
    tumor_location: row.tumor_location || null,
    tumor_stage: row.tumor_stage || null,
    molecular_markers: row.molecular_markers || {},
    assigned_doctor_id: row.assigned_doctor_id || null,
    archived_at: row.archived_at || null,
    archive_reason: row.archive_reason || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

// Vista para roles sin acceso clínico (secretaría, finanzas): sin diagnóstico ni datos tumorales.
export function toBasicPatient(patient) {
  return {
    id: patient.id,
    full_name: patient.full_name,
    dni: patient.dni,
    contact: patient.contact,
    status: patient.status,
    assigned_doctor_id: patient.assigned_doctor_id,
    archived_at: patient.archived_at,
  };
}
