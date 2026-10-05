export function normalizeSecretaryAppointment(appointment = {}) {
  return {
    ...appointment,
    patientId: appointment.patient_id,
    patientName: appointment.patient?.full_name || 'Paciente desconocido',
  };
}
