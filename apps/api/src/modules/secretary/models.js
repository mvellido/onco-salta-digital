export function normalizeSecretaryAppointment(appointment = {}) {
  return {
    ...appointment,
    patientId: appointment.patient_id,
    patientName: appointment.patient?.full_name || 'Paciente desconocido',
  };
}

export function normalizePermissionInput(payload = {}) {
  return {
    role: String(payload.role || '').trim(),
    permissions: Array.isArray(payload.permissions) ? payload.permissions.map((item) => String(item).trim()).filter(Boolean) : [],
  };
}
