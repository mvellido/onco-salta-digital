import { useMemo } from 'react';
import WeekCalendar from '../features/agenda/WeekCalendar';
import { addDays, startOfWeek, todayIso } from '../features/agenda/agendaUtils';

// Agenda con turnos ficticios para revisar el diseño (solo en desarrollo).
export default function DemoAgendaPage() {
  const monday = startOfWeek(todayIso());
  const days = Array.from({ length: 6 }, (_, i) => addDays(monday, i));
  const appointments = useMemo(() => {
    const a = (id, day, time, duration, kind, name, extra = {}) => ({ id, date: days[day], time, duration_minutes: duration, kind, patientName: name, status: 'scheduled', professional: { full_name: 'Dra. Ejemplo' }, ...extra });
    return [
      a('1', 0, '09:00', 45, 'primera_vez', 'Paciente A'),
      a('2', 0, '09:45', 20, 'control', 'Paciente B', { status: 'confirmed' }),
      a('3', 0, '10:00', 180, 'quimioterapia', 'Paciente C', { resource: 'Sillón 2' }),
      a('4', 0, '10:15', 30, 'consulta', 'Paciente D', { is_overbook: true }),
      a('5', 1, '11:00', 20, 'radioterapia', 'Paciente E'),
      a('6', 2, '08:30', 60, 'procedimiento', 'Paciente F', { status: 'completed' }),
      a('7', 2, '14:00', 30, 'estudio', 'Paciente G', { status: 'cancelled' }),
      a('8', 3, '09:00', 240, 'quimioterapia', 'Paciente H', { resource: 'Sillón 1' }),
      a('9', 4, '16:00', 30, 'consulta', 'Paciente I'),
    ];
  }, [monday]);
  const schedules = [1, 2, 3, 4, 5].map((weekday) => ({ id: `s${weekday}`, weekday, start_time: '08:00', end_time: weekday === 5 ? '13:00' : '17:00' }));

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="message message--error" role="note">Agenda de ejemplo con turnos ficticios.</div>
      <section className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
        <WeekCalendar days={days} appointments={appointments} schedules={schedules} showProfessional onSlotClick={() => {}} onAppointmentClick={() => {}} />
      </section>
    </div>
  );
}
