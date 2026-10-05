export function hasScheduleConflict(appointments = [], candidate = {}, currentAppointmentId = null) {
  return appointments.some((appointment) => {
    if (currentAppointmentId && appointment.id === currentAppointmentId) {
      return false;
    }

    if (appointment.status === 'cancelled') {
      return false;
    }

    return appointment.patient_id === candidate.patient_id
      && appointment.date === candidate.date
      && appointment.time === candidate.time;
  });
}

// Todavía no hay un canal de envío conectado (Etapa 4): la notificación queda
// registrada en auditoría con estado "not_sent" para no informar un envío falso.
export function buildNotificationDispatch({ channel = 'in-app', recipients = [], message = '' }) {
  return {
    channel,
    recipients,
    message,
    status: recipients.length ? 'not_sent' : 'skipped',
    registeredAt: new Date().toISOString(),
  };
}
