export function buildPatientUpdatePayload(body = {}) {
  return {
    full_name: body.full_name,
    diagnosis_summary: body.diagnosis_summary,
    status: body.status,
    dni: body.dni,
    birth_date: body.birth_date,
    gender: body.gender,
    contact: body.contact,
    tumor_location: body.tumor_location,
    tumor_stage: body.tumor_stage,
    molecular_markers: body.molecular_markers,
  };
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
