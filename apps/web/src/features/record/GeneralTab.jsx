import { useMemo, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { ECOG, TREATMENT_KIND_LABELS, ageFrom, formatDate, siteLabel } from './catalog';
import { STATUS_LABELS } from '../patients/PatientsTable';

function buildMilestones({ tumors, treatments, timeline }) {
  const items = [
    ...tumors.filter((t) => t.diagnosis_date).map((t) => ({ date: t.diagnosis_date, title: 'Diagnóstico', detail: siteLabel(t) })),
    ...treatments.filter((t) => t.start_date).map((t) => ({ date: t.start_date, title: TREATMENT_KIND_LABELS[t.kind], detail: t.regimen })),
    ...timeline.map((e) => ({ date: e.event_date, title: e.event_type, detail: e.description })),
  ];
  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(-8);
}

function DemographicsForm({ patient, onCancel, onSave, saving }) {
  const [form, setForm] = useState({
    full_name: patient.full_name || '',
    dni: patient.dni || '',
    birth_date: patient.birth_date || '',
    gender: patient.gender || 'No especificado',
    contact: patient.contact || '',
    status: patient.status || 'active',
    diagnosis_summary: patient.diagnosis_summary || '',
  });
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          full_name: form.full_name.trim(),
          dni: form.dni.trim() || null,
          birth_date: form.birth_date || null,
          gender: form.gender,
          contact: form.contact.trim() || null,
          status: form.status,
          diagnosis_summary: form.diagnosis_summary.trim(),
        });
      }}
      style={{ display: 'grid', gap: 12 }}
    >
      <div className="form-grid">
        <label>Nombre completo<input id="pt-name" required value={form.full_name} onChange={set('full_name')} /></label>
        <label>DNI<input id="pt-dni" value={form.dni} onChange={set('dni')} /></label>
        <label>Fecha de nacimiento<input id="pt-birth" type="date" value={form.birth_date} onChange={set('birth_date')} /></label>
        <label>
          Sexo
          <select id="pt-gender" value={form.gender} onChange={set('gender')}>
            {['No especificado', 'Femenino', 'Masculino', 'Otro'].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label>Contacto<input id="pt-contact" value={form.contact} onChange={set('contact')} /></label>
        <label>
          Estado
          <select id="pt-status" value={form.status} onChange={set('status')}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <label>Diagnóstico (resumen)<textarea id="pt-dx" rows="2" value={form.diagnosis_summary} onChange={set('diagnosis_summary')} /></label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving || !form.full_name.trim()}>{saving ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

export default function GeneralTab({ patient, tumors, treatments, timeline, canWrite, onUpdatePatient }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [allergyDraft, setAllergyDraft] = useState('');
  const milestones = useMemo(() => buildMilestones({ tumors, treatments, timeline }), [tumors, treatments, timeline]);
  const age = ageFrom(patient.birth_date);
  const today = new Date().toISOString().slice(0, 10);

  const update = async (changes) => {
    setSaving(true);
    setError('');
    try {
      await onUpdatePatient(changes);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addAllergy = (event) => {
    event.preventDefault();
    if (!allergyDraft.trim()) return;
    update({ allergies: [...(patient.allergies || []), allergyDraft.trim()] });
    setAllergyDraft('');
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {error ? <div className="message message--error" role="alert">{error}</div> : null}

      <section style={{ display: 'grid', gap: 10 }}>
        <div className="toolbar">
          <span className="eyebrow">Datos generales</span>
          {canWrite && !editing ? (
            <button type="button" className="secondary icon-button" onClick={() => setEditing(true)}>
              <Pencil size={14} aria-hidden="true" /> Editar
            </button>
          ) : null}
        </div>
        {editing ? (
          <DemographicsForm patient={patient} onCancel={() => setEditing(false)} onSave={update} saving={saving} />
        ) : (
          <dl className="kv">
            <dt>DNI</dt><dd className="mono">{patient.dni || '—'}</dd>
            <dt>Nacimiento</dt><dd><span className="mono">{formatDate(patient.birth_date)}</span>{age != null ? ` · ${age} años` : ''}</dd>
            <dt>Sexo</dt><dd>{patient.gender}</dd>
            <dt>Contacto</dt><dd>{patient.contact || '—'}</dd>
            <dt>Estado</dt><dd><span className={`status-pill status-pill--${patient.status}`}>{STATUS_LABELS[patient.status]}</span></dd>
            <dt>Diagnóstico</dt><dd>{patient.diagnosis_summary || '—'}</dd>
          </dl>
        )}
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <span className="eyebrow">Estado funcional (ECOG)</span>
        <div className="segmented" role="group" aria-label="ECOG">
          {ECOG.map((level) => (
            <button
              key={level.value}
              type="button"
              aria-pressed={patient.ecog === level.value}
              disabled={!canWrite || saving}
              title={level.label}
              onClick={() => update({ ecog: level.value })}
            >
              {level.value}
            </button>
          ))}
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          {patient.ecog != null
            ? <>{ECOG[patient.ecog].label} <span className="mono">· registrado {formatDate(patient.ecog_updated_at)}</span></>
            : 'Sin registrar.'}
        </p>
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <span className="eyebrow">Alergias</span>
        <div className="chip-row">
          {(patient.allergies || []).length ? patient.allergies.map((allergy) => (
            <span key={allergy} className="chip chip--alert">
              {allergy}
              {canWrite ? (
                <button
                  type="button"
                  aria-label={`Quitar alergia ${allergy}`}
                  disabled={saving}
                  onClick={() => update({ allergies: patient.allergies.filter((a) => a !== allergy) })}
                  style={{ background: 'none', border: 0, padding: 0, color: 'inherit', display: 'inline-flex' }}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              ) : null}
            </span>
          )) : <span style={{ color: 'var(--muted)' }}>Sin alergias registradas.</span>}
        </div>
        {canWrite ? (
          <form onSubmit={addAllergy} style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
            <input id="allergy-input" aria-label="Nueva alergia" value={allergyDraft} onChange={(e) => setAllergyDraft(e.target.value)} placeholder="Ej.: platino, penicilina" />
            <button type="submit" className="secondary" disabled={saving || !allergyDraft.trim()}>Agregar</button>
          </form>
        ) : null}
      </section>

      <section style={{ display: 'grid', gap: 6 }}>
        <span className="eyebrow">Línea de tiempo</span>
        {milestones.length ? (
          <div className="hline">
            {milestones.map((item, index) => (
              <div key={index} className={`hline__item${item.date > today ? ' hline__item--future' : ''}`}>
                <strong>{item.title}</strong>
                <time dateTime={item.date}>{formatDate(item.date)}</time>
                <div style={{ color: 'var(--muted)', overflowWrap: 'anywhere' }}>{item.detail}</div>
              </div>
            ))}
          </div>
        ) : <p style={{ color: 'var(--muted)' }}>Se arma sola a medida que cargás diagnósticos, tratamientos y eventos.</p>}
      </section>
    </div>
  );
}
