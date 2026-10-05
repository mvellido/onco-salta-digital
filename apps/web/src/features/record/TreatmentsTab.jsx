import { useState } from 'react';
import { Activity, Crosshair, FlaskConical, HeartPulse, Pencil, Pill, Plus, Radiation, Scissors, ShieldPlus } from 'lucide-react';
import {
  TREATMENT_KIND_LABELS,
  TREATMENT_INTENT_LABELS,
  TREATMENT_STATUS_LABELS,
  siteLabel,
  formatDate,
} from './catalog';

const KIND_ICONS = {
  chemotherapy: FlaskConical,
  immunotherapy: ShieldPlus,
  targeted: Crosshair,
  hormonal: Pill,
  radiotherapy: Radiation,
  surgery: Scissors,
  supportive: HeartPulse,
  other: Activity,
};

const STATUS_CHIP = { planned: 'chip--muted', active: 'chip--teal', completed: '', suspended: 'chip--alert' };

const EMPTY = {
  kind: 'chemotherapy',
  regimen: '',
  dose: '',
  frequency: '',
  intent: '',
  line: '',
  tumor_id: '',
  start_date: '',
  end_date: '',
  cycles_planned: '',
  cycles_done: 0,
  status: 'planned',
  suspension_reason: '',
  notes: '',
};

function toForm(treatment) {
  if (!treatment) return EMPTY;
  return Object.fromEntries(Object.keys(EMPTY).map((key) => [key, treatment[key] ?? EMPTY[key]]));
}

function toPayload(form) {
  const text = (value) => (value?.trim() ? value.trim() : null);
  const int = (value) => (value === '' || value == null ? null : Number(value));
  return {
    kind: form.kind,
    regimen: form.regimen.trim(),
    dose: text(form.dose),
    frequency: text(form.frequency),
    intent: form.intent || null,
    line: int(form.line),
    tumor_id: form.tumor_id || null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    cycles_planned: int(form.cycles_planned),
    cycles_done: Number(form.cycles_done || 0),
    status: form.status,
    suspension_reason: text(form.suspension_reason),
    notes: text(form.notes),
  };
}

function Cycles({ done, planned }) {
  if (!planned) return null;
  return (
    <div className="cycles" aria-label={`${done} de ${planned} ciclos`}>
      {Array.from({ length: planned }, (_, i) => <i key={i} className={i < done ? 'done' : ''} />)}
    </div>
  );
}

function TreatmentForm({ treatment, tumors, onCancel, onSave, saving, error }) {
  const [form, setForm] = useState(() => toForm(treatment));
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); onSave(toPayload(form)); }}
      style={{ display: 'grid', gap: 12, padding: 14, border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-solid)' }}
    >
      <strong>{treatment ? 'Editar tratamiento' : 'Nuevo tratamiento'}</strong>
      <div className="form-grid">
        <label>
          Tipo
          <select id="tx-kind" value={form.kind} onChange={set('kind')}>
            {Object.entries(TREATMENT_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label style={{ gridColumn: 'span 2' }}>
          Esquema o droga <span style={{ color: 'var(--danger)' }}>*</span>
          <input id="tx-regimen" required value={form.regimen} onChange={set('regimen')} placeholder="Ej.: Carboplatino + Pemetrexed" />
        </label>
        <label>
          Dosis
          <input id="tx-dose" value={form.dose} onChange={set('dose')} placeholder="Ej.: AUC 5 / 500 mg/m²" />
        </label>
        <label>
          Frecuencia
          <input id="tx-frequency" value={form.frequency} onChange={set('frequency')} placeholder="Ej.: cada 21 días" />
        </label>
        <label>
          Intención
          <select id="tx-intent" value={form.intent || ''} onChange={set('intent')}>
            <option value="">—</option>
            {Object.entries(TREATMENT_INTENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Línea
          <input id="tx-line" type="number" min="1" max="10" value={form.line ?? ''} onChange={set('line')} />
        </label>
        {tumors.length ? (
          <label>
            Tumor
            <select id="tx-tumor" value={form.tumor_id || ''} onChange={set('tumor_id')}>
              <option value="">—</option>
              {tumors.map((tumor) => <option key={tumor.id} value={tumor.id}>{siteLabel(tumor)}</option>)}
            </select>
          </label>
        ) : null}
        <label>
          Inicio
          <input id="tx-start" type="date" value={form.start_date || ''} onChange={set('start_date')} />
        </label>
        <label>
          Fin
          <input id="tx-end" type="date" value={form.end_date || ''} onChange={set('end_date')} />
        </label>
        <label>
          Ciclos planificados
          <input id="tx-cycles-planned" type="number" min="1" max="100" value={form.cycles_planned ?? ''} onChange={set('cycles_planned')} />
        </label>
        <label>
          Ciclos realizados
          <input id="tx-cycles-done" type="number" min="0" max="100" value={form.cycles_done} onChange={set('cycles_done')} />
        </label>
        <label>
          Estado
          <select id="tx-status" value={form.status} onChange={set('status')}>
            {Object.entries(TREATMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {form.status === 'suspended' ? (
        <label>
          Motivo de la suspensión <span style={{ color: 'var(--danger)' }}>*</span>
          <input id="tx-suspension" required value={form.suspension_reason} onChange={set('suspension_reason')} placeholder="Ej.: neutropenia grado 4" />
        </label>
      ) : null}
      <label>
        Notas
        <textarea id="tx-notes" rows="2" value={form.notes} onChange={set('notes')} />
      </label>
      {error ? <div className="message message--error" role="alert">{error}</div> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving || !form.regimen.trim()}>{saving ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

export default function TreatmentsTab({ treatments, tumors, canWrite, onSaveTreatment }) {
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (id, payload) => {
    setSaving(true);
    setError('');
    try {
      await onSaveTreatment(id, payload);
      setEditing(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addCycle = (treatment) => save(treatment.id, {
    cycles_done: treatment.cycles_done + 1,
    ...(treatment.status === 'planned' ? { status: 'active' } : {}),
    ...(treatment.cycles_done + 1 === treatment.cycles_planned ? { status: 'completed' } : {}),
  });

  const active = treatments.filter((t) => t.status === 'active').length;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="toolbar">
        <div>
          <span className="eyebrow">Tratamientos y medicación</span>
          <h2>{treatments.length ? `${active} en curso · ${treatments.length} en total` : 'Sin tratamientos cargados'}</h2>
        </div>
        {canWrite && editing !== 'new' ? (
          <button type="button" className="icon-button" onClick={() => { setEditing('new'); setError(''); }}>
            <Plus size={16} aria-hidden="true" /> Nuevo tratamiento
          </button>
        ) : null}
      </div>

      {editing === 'new' ? (
        <TreatmentForm tumors={tumors} onCancel={() => setEditing(null)} onSave={(payload) => save(null, payload)} saving={saving} error={error} />
      ) : null}

      <div className="treatment-list">
        {treatments.map((treatment) => {
          if (editing === treatment.id) {
            return (
              <TreatmentForm key={treatment.id} treatment={treatment} tumors={tumors} onCancel={() => setEditing(null)} onSave={(payload) => save(treatment.id, payload)} saving={saving} error={error} />
            );
          }
          const Icon = KIND_ICONS[treatment.kind] || Activity;
          const canAddCycle = canWrite && treatment.cycles_planned && treatment.cycles_done < treatment.cycles_planned && ['planned', 'active'].includes(treatment.status);
          return (
            <article key={treatment.id} className="treatment-card">
              <div className="treatment-card__icon" aria-hidden="true"><Icon size={20} /></div>
              <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                <div className="treatment-card__title">
                  {treatment.regimen}
                  <span className={`chip ${STATUS_CHIP[treatment.status]}`} style={{ marginLeft: 8 }}>{TREATMENT_STATUS_LABELS[treatment.status]}</span>
                </div>
                <div className="treatment-card__meta">
                  <span>{TREATMENT_KIND_LABELS[treatment.kind]}</span>
                  {treatment.intent ? <span>{TREATMENT_INTENT_LABELS[treatment.intent]}</span> : null}
                  {treatment.line ? <span>{treatment.line}.ª línea</span> : null}
                  {treatment.dose ? <span>{treatment.dose}</span> : null}
                  {treatment.frequency ? <span>{treatment.frequency}</span> : null}
                  <span className="mono">{formatDate(treatment.start_date)}{treatment.end_date ? ` → ${formatDate(treatment.end_date)}` : ''}</span>
                </div>
                {treatment.cycles_planned ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Cycles done={treatment.cycles_done} planned={treatment.cycles_planned} />
                    <span className="mono" style={{ color: 'var(--muted)' }}>{treatment.cycles_done}/{treatment.cycles_planned} ciclos</span>
                  </div>
                ) : null}
                {treatment.status === 'suspended' && treatment.suspension_reason ? (
                  <p style={{ color: 'var(--danger)', fontSize: '0.88rem' }}>Suspendido: {treatment.suspension_reason}</p>
                ) : null}
              </div>
              {canWrite ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {canAddCycle ? (
                    <button type="button" className="secondary" disabled={saving} onClick={() => addCycle(treatment)}>+1 ciclo</button>
                  ) : null}
                  <button type="button" className="secondary icon-button" onClick={() => { setEditing(treatment.id); setError(''); }}>
                    <Pencil size={14} aria-hidden="true" /> Editar
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {error && !editing ? <div className="message message--error" role="alert">{error}</div> : null}
    </div>
  );
}
