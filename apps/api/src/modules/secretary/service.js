export const APPOINTMENT_KINDS = ['primera_vez', 'consulta', 'control', 'quimioterapia', 'radioterapia', 'estudio', 'procedimiento', 'otro'];
export const APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled'];

export function toMinutes(time) {
  const [h, m] = String(time).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// 1 = lunes … 7 = domingo, sin depender de la zona horaria del servidor.
export function isoWeekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

function interval(appointment) {
  const start = toMinutes(appointment.time);
  return [start, start + Number(appointment.duration_minutes || 30)];
}

function overlaps(a, b) {
  if (a.date !== b.date) return false;
  const [aStart, aEnd] = interval(a);
  const [bStart, bEnd] = interval(b);
  return aStart < bEnd && bStart < aEnd;
}

// Turnos activos que se superponen con el candidato, separados por motivo.
export function findConflicts(appointments = [], candidate = {}, currentAppointmentId = null) {
  const active = appointments.filter((a) => a.id !== currentAppointmentId && a.status !== 'cancelled' && overlaps(a, candidate));
  return {
    patient: active.filter((a) => a.patient_id === candidate.patient_id),
    professional: candidate.professional_id ? active.filter((a) => a.professional_id === candidate.professional_id) : [],
    resource: candidate.resource ? active.filter((a) => a.resource && a.resource.toLowerCase() === candidate.resource.toLowerCase()) : [],
  };
}

// Compatibilidad: conflicto del mismo paciente en el mismo horario.
export function hasScheduleConflict(appointments = [], candidate = {}, currentAppointmentId = null) {
  return findConflicts(appointments, candidate, currentAppointmentId).patient.length > 0;
}

export function isWithinSchedule(schedules = [], candidate = {}) {
  const weekday = isoWeekday(candidate.date);
  const [start, end] = interval(candidate);
  return schedules.some((block) => block.weekday === weekday && toMinutes(block.start_time) <= start && end <= toMinutes(block.end_time));
}

// Horarios libres de un profesional para una fecha, según su horario semanal.
export function computeFreeSlots({ schedules = [], appointments = [], date, duration = 30 }) {
  const weekday = isoWeekday(date);
  const taken = appointments.filter((a) => a.date === date && a.status !== 'cancelled');
  const slots = [];

  for (const block of schedules.filter((b) => b.weekday === weekday)) {
    const step = Number(block.slot_minutes || 30);
    for (let t = toMinutes(block.start_time); t + duration <= toMinutes(block.end_time); t += step) {
      const candidate = { date, time: fromMinutes(t), duration_minutes: duration };
      if (!taken.some((a) => overlaps(a, candidate))) slots.push(candidate.time);
    }
  }

  return [...new Set(slots)].sort();
}

export function describeConflict(appointment) {
  const who = appointment.patient?.full_name || 'otro paciente';
  return `${appointment.time} (${appointment.duration_minutes || 30} min) · ${who}`;
}

// Todavía no hay un canal de envío conectado: la notificación queda
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
