export const KINDS = {
  primera_vez: { label: 'Primera vez', short: '1.ª vez' },
  consulta: { label: 'Consulta', short: 'Consulta' },
  control: { label: 'Control', short: 'Control' },
  quimioterapia: { label: 'Quimioterapia', short: 'QT' },
  radioterapia: { label: 'Radioterapia', short: 'RT' },
  estudio: { label: 'Estudio', short: 'Estudio' },
  procedimiento: { label: 'Procedimiento', short: 'Proced.' },
  otro: { label: 'Otro', short: 'Otro' },
};

export const STATUSES = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Atendido',
  cancelled: 'Cancelado',
};

export const DEFAULT_DURATION = { primera_vez: 45, consulta: 30, control: 20, quimioterapia: 180, radioterapia: 20, estudio: 30, procedimiento: 60, otro: 30 };

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Fechas como texto AAAA-MM-DD, calculadas en UTC para no depender del huso horario.
const parse = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const format = (d) => d.toISOString().slice(0, 10);

export function todayIso() {
  const now = new Date();
  return format(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function addDays(date, days) {
  return format(new Date(parse(date).getTime() + days * 86400000));
}

export function startOfWeek(date) {
  const day = parse(date).getUTCDay() || 7;
  return addDays(date, 1 - day);
}

export function isoWeekday(date) {
  return parse(date).getUTCDay() || 7;
}

export function dayLabel(date) {
  const d = parse(date);
  return { weekday: WEEKDAYS[(d.getUTCDay() || 7) - 1], day: `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}` };
}

export function weekLabel(monday) {
  const end = addDays(monday, 5);
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const a = parse(monday);
  const b = parse(end);
  return `${a.getUTCDate()} ${months[a.getUTCMonth()]} – ${b.getUTCDate()} ${months[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

export function toMinutes(time) {
  const [h, m] = String(time).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function endTime(appointment) {
  return fromMinutes(toMinutes(appointment.time) + Number(appointment.duration_minutes || 30));
}

// Reparte turnos superpuestos del mismo día en carriles lado a lado.
export function layoutLanes(appointments) {
  const sorted = [...appointments].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  const placed = [];
  let group = [];
  let groupEnd = -1;

  const flush = () => {
    const lanes = Math.max(1, ...group.map((item) => item.lane + 1));
    group.forEach((item) => placed.push({ ...item, lanes }));
    group = [];
  };

  for (const appointment of sorted) {
    const start = toMinutes(appointment.time);
    const end = start + Number(appointment.duration_minutes || 30);
    if (start >= groupEnd && group.length) flush();
    const busy = new Set(group.filter((item) => item.end > start).map((item) => item.lane));
    let lane = 0;
    while (busy.has(lane)) lane += 1;
    group.push({ appointment, start, end, lane });
    groupEnd = Math.max(groupEnd, end);
  }
  if (group.length) flush();
  return placed;
}
