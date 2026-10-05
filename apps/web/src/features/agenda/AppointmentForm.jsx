import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { apiJson } from '../../lib/api';
import { DEFAULT_DURATION, KINDS, STATUSES, endTime } from './agendaUtils';

function emptyForm(seed = {}) {
  return {
    patient_id: '',
    professional_id: '',
    date: '',
    time: '',
    kind: 'consulta',
    duration_minutes: 30,
    resource: '',
    note: '',
    ...seed,
  };
}

export default function AppointmentForm({ appointment, seed, patients, professionals, canWrite, onSaved, onDeleted, onClose }) {
  const editing = Boolean(appointment);
  const [form, setForm] = useState(() => (editing
    ? emptyForm({
      patient_id: appointment.patient_id,
      professional_id: appointment.professional_id || '',
      date: appointment.date,
      time: appointment.time,
      kind: appointment.kind,
      duration_minutes: appointment.duration_minutes,
      resource: appointment.resource || '',
      note: appointment.note || '',
    })
    : emptyForm(seed)));
  const [patientQuery, setPatientQuery] = useState('');
  const [freeSlots, setFreeSlots] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [needsOverbook, setNeedsOverbook] = useState(false);
  const [warnings, setWarnings] = useState([]);

  const set = (field) => (event) => {
    setNeedsOverbook(false);
    setForm({ ...form, [field]: event.target.value });
  };

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    const list = q ? patients.filter((p) => p.full_name.toLowerCase().includes(q) || (p.dni || '').includes(q)) : patients;
    return list.slice(0, 50);
  }, [patients, patientQuery]);

  // Al elegir paciente, sugerir su médico asignado.
  useEffect(() => {
    if (editing || form.professional_id || !form.patient_id) return;
    const patient = patients.find((p) => p.id === form.patient_id);
    if (patient?.assigned_doctor_id && professionals.some((p) => p.id === patient.assigned_doctor_id)) {
      setForm((current) => ({ ...current, professional_id: patient.assigned_doctor_id }));
    }
  }, [form.patient_id, form.professional_id, patients, professionals, editing]);

  useEffect(() => {
    if (!form.professional_id || !form.date) {
      setFreeSlots(null);
      return undefined;
    }
    let cancelled = false;
    apiJson(`/agenda/free-slots?professional_id=${form.professional_id}&date=${form.date}&duration=${form.duration_minutes || 30}`)
      .then((result) => { if (!cancelled) setFreeSlots(result); })
      .catch(() => { if (!cancelled) setFreeSlots(null); });
    return () => { cancelled = true; };
  }, [form.professional_id, form.date, form.duration_minutes]);

  const save = async (overbook = false) => {
    setSaving(true);
    setError('');
    setWarnings([]);
    const payload = {
      patient_id: form.patient_id,
      professional_id: form.professional_id || null,
      date: form.date,
      time: form.time,
      kind: form.kind,
      duration_minutes: Number(form.duration_minutes),
      resource: form.resource.trim() || null,
      note: form.note,
      ...(overbook ? { overbook: true } : {}),
    };
    try {
      const saved = await apiJson(editing ? `/appointments/${appointment.id}` : '/appointments', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setWarnings(saved.warnings || []);
      onSaved(saved, saved.warnings || []);
    } catch (err) {
      setError(err.message);
      setNeedsOverbook(/sobreturno/i.test(err.message));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status) => {
    setSaving(true);
    setError('');
    try {
      onSaved(await apiJson(`/appointments/${appointment.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }), []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await apiJson(`/appointments/${appointment.id}`, { method: 'DELETE' });
      onDeleted(appointment.id);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const valid = form.patient_id && form.date && /^\d{2}:\d{2}$/.test(form.time) && Number(form.duration_minutes) >= 5;

  return (
    <aside className="side-card agenda-form" aria-label={editing ? 'Editar turno' : 'Nuevo turno'}>
      <div className="toolbar">
        <h2>{editing ? 'Turno' : 'Nuevo turno'}</h2>
        <button type="button" className="secondary" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
      </div>

      {editing ? (
        <div className="chip-row">
          <span className={`chip appt-chip appt--${appointment.kind}`}>{KINDS[appointment.kind]?.label}</span>
          <span className="chip chip--muted">{STATUSES[appointment.status]}</span>
          {appointment.is_overbook ? <span className="chip chip--warn">Sobreturno</span> : null}
          <span className="chip chip--muted">{appointment.time}–{endTime(appointment)}</span>
        </div>
      ) : null}

      <form onSubmit={(event) => { event.preventDefault(); save(false); }} style={{ display: 'grid', gap: 10 }}>
        <label>
          Paciente
          {!editing ? (
            <input id="appt-patient-search" type="search" placeholder="Buscar por nombre o DNI" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
          ) : null}
          <select id="appt-patient" value={form.patient_id} onChange={set('patient_id')} disabled={!canWrite} required>
            <option value="">Elegí un paciente</option>
            {filteredPatients.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.dni ? ` · ${p.dni}` : ''}</option>)}
          </select>
        </label>

        <label>
          Profesional
          <select id="appt-professional" value={form.professional_id} onChange={set('professional_id')} disabled={!canWrite}>
            <option value="">Sin asignar</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </select>
        </label>

        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
          <label>Fecha<input id="appt-date" type="date" required value={form.date} onChange={set('date')} disabled={!canWrite} /></label>
          <label>Hora<input id="appt-time" type="time" step="300" required value={form.time} onChange={set('time')} disabled={!canWrite} /></label>
        </div>

        {freeSlots && canWrite ? (
          freeSlots.hasSchedule ? (
            freeSlots.slots.length ? (
              <div className="chip-row" aria-label="Horarios libres">
                {freeSlots.slots.slice(0, 16).map((slot) => (
                  <button key={slot} type="button" className="chip-button" aria-pressed={form.time === slot} onClick={() => setForm({ ...form, time: slot })}
                    style={form.time === slot ? { background: 'var(--accent)', color: '#fff', borderStyle: 'solid', borderColor: 'var(--accent)' } : undefined}>
                    {slot}
                  </button>
                ))}
              </div>
            ) : <p style={{ color: 'var(--warn)', fontSize: '0.85rem' }}>No quedan horarios libres ese día para esa duración.</p>
          ) : <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>El profesional no tiene horario de atención cargado.</p>
        ) : null}

        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
          <label>
            Tipo
            <select id="appt-kind" value={form.kind} disabled={!canWrite}
              onChange={(e) => setForm({ ...form, kind: e.target.value, duration_minutes: editing ? form.duration_minutes : DEFAULT_DURATION[e.target.value] })}>
              {Object.entries(KINDS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
          </label>
          <label>Duración (min)<input id="appt-duration" type="number" min="5" max="480" step="5" value={form.duration_minutes} onChange={set('duration_minutes')} disabled={!canWrite} /></label>
        </div>

        <label>
          Consultorio o sillón
          <input id="appt-resource" list="appt-resources" value={form.resource} onChange={set('resource')} placeholder="Ej.: Consultorio 2, Sillón 3" disabled={!canWrite} />
          <datalist id="appt-resources">
            {['Consultorio 1', 'Consultorio 2', 'Sillón 1', 'Sillón 2', 'Sillón 3', 'Sillón 4'].map((r) => <option key={r} value={r} />)}
          </datalist>
        </label>

        <label>Nota<textarea id="appt-note" rows="2" value={form.note} onChange={set('note')} disabled={!canWrite} /></label>

        {error ? <div className="message message--error" role="alert">{error}</div> : null}
        {warnings.map((w) => <div key={w} className="message" style={{ background: 'var(--warn-soft)', borderColor: '#e9c98f' }}>{w}</div>)}

        {canWrite ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" disabled={saving || !valid}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agendar'}</button>
            {needsOverbook ? (
              <button type="button" className="secondary" disabled={saving} onClick={() => save(true)}>Dar como sobreturno</button>
            ) : null}
          </div>
        ) : null}
      </form>

      {editing && canWrite ? (
        <div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <span className="eyebrow">Estado</span>
          <div className="chip-row">
            {appointment.status !== 'confirmed' && appointment.status !== 'cancelled' ? <button type="button" className="secondary" disabled={saving} onClick={() => changeStatus('confirmed')}>Confirmar</button> : null}
            {appointment.status !== 'completed' && appointment.status !== 'cancelled' ? <button type="button" className="secondary" disabled={saving} onClick={() => changeStatus('completed')}>Marcar atendido</button> : null}
            {appointment.status !== 'cancelled' ? <button type="button" className="ghost" disabled={saving} onClick={() => changeStatus('cancelled')}>Cancelar turno</button> : null}
            {appointment.status === 'cancelled' ? <button type="button" className="secondary" disabled={saving} onClick={() => changeStatus('scheduled')}>Reactivar</button> : null}
            <button type="button" className="ghost" disabled={saving} onClick={remove}>Eliminar</button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
