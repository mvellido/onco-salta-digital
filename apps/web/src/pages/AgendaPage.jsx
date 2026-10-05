import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, List, Plus } from 'lucide-react';
import { apiJson } from '../lib/api';
import { useMe } from '../app/MeContext';
import WeekCalendar from '../features/agenda/WeekCalendar';
import AppointmentForm from '../features/agenda/AppointmentForm';
import ScheduleEditor from '../features/agenda/ScheduleEditor';
import { KINDS, STATUSES, addDays, dayLabel, endTime, startOfWeek, todayIso, weekLabel } from '../features/agenda/agendaUtils';

const isTyping = (target) => target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

export default function AgendaPage() {
  const { me, can } = useMe();
  const canWrite = can('appointments:write');
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(todayIso());
  const [professionalId, setProfessionalId] = useState(me.role === 'doctor' ? me.id : '');
  const [professionals, setProfessionals] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [panel, setPanel] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const monday = startOfWeek(anchor);
  const days = useMemo(() => (view === 'day' ? [anchor] : Array.from({ length: 6 }, (_, i) => addDays(monday, i))), [view, anchor, monday]);
  const from = days[0];
  const to = days.at(-1);

  useEffect(() => {
    apiJson('/professionals').then(setProfessionals).catch(() => setProfessionals([]));
    apiJson('/patients').then(setPatients).catch(() => setPatients([]));
  }, []);

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({ from, to, ...(professionalId ? { professional_id: professionalId } : {}) });
      setAppointments(await apiJson(`/appointments?${query}`));
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }, [from, to, professionalId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!professionalId) {
      setSchedules([]);
      return;
    }
    apiJson(`/professionals/${professionalId}/schedule`).then(setSchedules).catch(() => setSchedules([]));
  }, [professionalId]);

  const step = useCallback((direction) => setAnchor((current) => addDays(current, (view === 'day' ? 1 : 7) * direction)), [view]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target) || panel) return;
      if (event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'ArrowRight') step(1);
      else if (event.key.toLowerCase() === 't') setAnchor(todayIso());
      else if (event.key.toLowerCase() === 'n' && canWrite) setPanel({ type: 'new', seed: { date: anchor, professional_id: professionalId } });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, panel, canWrite, anchor, professionalId]);

  const counters = useMemo(() => appointments.reduce((acc, a) => ({ ...acc, [a.status]: (acc[a.status] || 0) + 1 }), {}), [appointments]);
  const selectedProfessional = professionals.find((p) => p.id === professionalId);
  const canEditSchedule = selectedProfessional && canWrite && (professionalId === me.id || can('users:manage'));

  const onSaved = (saved, warnings) => {
    setAppointments((current) => {
      const exists = current.some((a) => a.id === saved.id);
      const inRange = saved.date >= from && saved.date <= to && (!professionalId || saved.professional_id === professionalId);
      if (!inRange) return current.filter((a) => a.id !== saved.id);
      return exists ? current.map((a) => (a.id === saved.id ? saved : a)) : [...current, saved];
    });
    setMessage({ type: 'success', text: `Turno ${saved.date.split('-').reverse().join('/')} ${saved.time} guardado.${warnings?.length ? ` ${warnings.join(' ')}` : ''}` });
    setPanel(null);
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section className="section-card agenda-toolbar">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="secondary" aria-label={view === 'day' ? 'Día anterior' : 'Semana anterior'} onClick={() => step(-1)}><ChevronLeft size={18} /></button>
          <button type="button" className="secondary" onClick={() => setAnchor(todayIso())}>Hoy</button>
          <button type="button" className="secondary" aria-label={view === 'day' ? 'Día siguiente' : 'Semana siguiente'} onClick={() => step(1)}><ChevronRight size={18} /></button>
          <h2 style={{ marginLeft: 8 }}>{view === 'day' ? `${dayLabel(anchor).weekday} ${dayLabel(anchor).day}` : weekLabel(monday)}</h2>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select aria-label="Profesional" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} style={{ width: 'auto' }}>
            <option value="">Todos los profesionales</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </select>
          <div className="segmented" role="group" aria-label="Vista">
            <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}><CalendarDays size={15} aria-hidden="true" /> Semana</button>
            <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}><Clock size={15} aria-hidden="true" /> Día</button>
            <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={15} aria-hidden="true" /> Lista</button>
          </div>
          {canEditSchedule ? <button type="button" className="secondary" onClick={() => setPanel({ type: 'schedule' })}>Horario de atención</button> : null}
          {canWrite ? (
            <button type="button" className="icon-button" onClick={() => setPanel({ type: 'new', seed: { date: anchor, professional_id: professionalId } })}>
              <Plus size={16} aria-hidden="true" /> Nuevo turno
            </button>
          ) : null}
        </div>
      </section>

      <div className="agenda-stats">
        {Object.entries(STATUSES).map(([status, label]) => (
          <div key={status} className="turns-counter"><span>{label}</span><strong>{counters[status] || 0}</strong></div>
        ))}
        <div className="agenda-legend" aria-label="Tipos de turno">
          {Object.entries(KINDS).map(([kind, meta]) => <span key={kind} className={`legend-dot appt--${kind}`}>{meta.label}</span>)}
        </div>
      </div>

      {message.text ? (
        <div className={`message message--${message.type === 'success' ? 'success' : 'error'}`} role="status">{message.text}</div>
      ) : null}

      <div className={panel ? 'agenda-layout agenda-layout--panel' : 'agenda-layout'}>
        <section className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
          {view === 'list' ? (
            appointments.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Día</th><th>Horario</th><th>Paciente</th><th>Tipo</th><th>Profesional</th><th>Recurso</th><th>Estado</th></tr></thead>
                  <tbody>
                    {appointments.map((a) => (
                      <tr key={a.id} onClick={() => setPanel({ type: 'edit', appointment: a })} style={{ cursor: 'pointer' }}>
                        <td className="mono">{dayLabel(a.date).day}</td>
                        <td className="mono">{a.time}–{endTime(a)}</td>
                        <td><strong>{a.patientName}</strong></td>
                        <td><span className={`legend-dot appt--${a.kind}`}>{KINDS[a.kind]?.label}</span></td>
                        <td>{a.professional?.full_name || '—'}</td>
                        <td>{a.resource || '—'}</td>
                        <td><span className={`turn-card__pill turn-card__pill--${a.status}`}>{STATUSES[a.status]}</span>{a.is_overbook ? <span className="pill pill--muted">ST</span> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state" style={{ margin: 16 }}>No hay turnos en este período.</div>
          ) : (
            <WeekCalendar
              days={days}
              appointments={appointments}
              schedules={schedules}
              showProfessional={!professionalId}
              onSlotClick={canWrite ? (date, time) => setPanel({ type: 'new', seed: { date, time, professional_id: professionalId } }) : undefined}
              onAppointmentClick={(appointment) => setPanel({ type: 'edit', appointment })}
            />
          )}
        </section>

        {panel?.type === 'new' || panel?.type === 'edit' ? (
          <AppointmentForm
            key={panel.type === 'edit' ? panel.appointment.id : `${panel.seed?.date}-${panel.seed?.time}`}
            appointment={panel.type === 'edit' ? panel.appointment : null}
            seed={panel.seed}
            patients={patients}
            professionals={professionals}
            canWrite={canWrite}
            onSaved={onSaved}
            onDeleted={(id) => { setAppointments((current) => current.filter((a) => a.id !== id)); setPanel(null); setMessage({ type: 'success', text: 'Turno eliminado.' }); }}
            onClose={() => setPanel(null)}
          />
        ) : null}

        {panel?.type === 'schedule' && selectedProfessional ? (
          <ScheduleEditor
            professional={selectedProfessional}
            onSaved={(saved) => { setSchedules(saved); setPanel(null); setMessage({ type: 'success', text: 'Horario de atención guardado.' }); }}
            onClose={() => setPanel(null)}
          />
        ) : null}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
        Atajos: <kbd>←</kbd> <kbd>→</kbd> semana · <kbd>T</kbd> hoy · <kbd>N</kbd> nuevo turno · clic en un hueco para agendar ahí.
      </p>
    </div>
  );
}
