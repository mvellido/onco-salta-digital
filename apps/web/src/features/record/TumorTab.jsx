import { useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import AnatomyMap from './AnatomyMap';
import {
  SITES,
  SYSTEMIC_SITES,
  LATERALITY_LABELS,
  T_OPTIONS,
  N_OPTIONS,
  M_OPTIONS,
  STAGE_GROUPS,
  TNM_PREFIX_LABELS,
  TUMOR_STATUS_LABELS,
  BIOMARKER_PRESETS,
  siteLabel,
  formatDate,
} from './catalog';

const EMPTY_TUMOR = {
  primary_site: '',
  laterality: 'na',
  site_detail: '',
  histology: '',
  size_mm: '',
  tnm_prefix: 'c',
  t_category: '',
  n_category: '',
  m_category: '',
  stage_group: '',
  grade: '',
  diagnosis_date: '',
  biomarkers: [],
  status: 'active',
  is_primary: true,
  notes: '',
};

const SIZE_SCALE_MM = 100;

function toForm(tumor) {
  if (!tumor) return EMPTY_TUMOR;
  return Object.fromEntries(Object.keys(EMPTY_TUMOR).map((key) => [key, tumor[key] ?? EMPTY_TUMOR[key]]));
}

// Convierte el formulario en el payload que espera la API (vacíos → null).
function toPayload(form) {
  const nullable = (value) => (value === '' || value == null ? null : value);
  return {
    primary_site: form.primary_site,
    laterality: form.laterality,
    site_detail: nullable(form.site_detail?.trim()),
    histology: nullable(form.histology?.trim()),
    size_mm: form.size_mm === '' ? null : Number(form.size_mm),
    tnm_prefix: form.tnm_prefix,
    t_category: nullable(form.t_category),
    n_category: nullable(form.n_category),
    m_category: nullable(form.m_category),
    stage_group: nullable(form.stage_group),
    grade: nullable(form.grade?.trim()),
    diagnosis_date: nullable(form.diagnosis_date),
    biomarkers: form.biomarkers.filter((b) => b.name.trim() && b.result.trim()).map((b) => ({ name: b.name.trim(), result: b.result.trim() })),
    status: form.status,
    is_primary: form.is_primary,
    notes: nullable(form.notes?.trim()),
  };
}

function TumorView({ tumor, gender, canWrite, onEdit }) {
  const sizePct = tumor.size_mm ? Math.min(100, (tumor.size_mm / SIZE_SCALE_MM) * 100) : 0;
  return (
    <div className="tumor-layout">
      <AnatomyMap selected={{ site: tumor.primary_site, laterality: tumor.laterality }} gender={gender} />

      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <div className="toolbar">
          <div>
            <span className="eyebrow">{tumor.is_primary ? 'Tumor primario' : 'Otro tumor'}</span>
            <h2>{[tumor.histology, siteLabel(tumor)].filter(Boolean).join(' · ')}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`chip ${tumor.status === 'progression' ? 'chip--alert' : tumor.status === 'remission' ? '' : 'chip--teal'}`}>
              {TUMOR_STATUS_LABELS[tumor.status]}
            </span>
            {canWrite ? (
              <button type="button" className="secondary icon-button" onClick={onEdit}>
                <Pencil size={15} aria-hidden="true" /> Editar
              </button>
            ) : null}
          </div>
        </div>

        <div className="tnm" aria-label="Estadificación TNM">
          {[['T', tumor.t_category], ['N', tumor.n_category], ['M', tumor.m_category]].map(([axis, value]) => (
            <div key={axis} className="tnm__cell">
              <span>{tumor.tnm_prefix}{axis}</span>
              <strong>{value ? value.replace(/^[TNM]/, '') : '—'}</strong>
            </div>
          ))}
          <div className="tnm__cell tnm__cell--stage">
            <span>Estadio</span>
            <strong>{tumor.stage_group || '—'}</strong>
          </div>
        </div>

        {tumor.size_mm ? (
          <div className="size-bar" aria-label={`Tamaño ${tumor.size_mm} milímetros`}>
            <span>Tamaño</span>
            <div className="size-bar__track"><div className="size-bar__fill" style={{ width: `${sizePct}%` }} /></div>
            <strong>{(tumor.size_mm / 10).toLocaleString('es-AR')} cm</strong>
          </div>
        ) : null}

        <dl className="kv">
          <dt>Ubicación</dt><dd>{tumor.site_detail || siteLabel(tumor)}</dd>
          <dt>Histología</dt><dd>{tumor.histology || '—'}</dd>
          <dt>Grado</dt><dd>{tumor.grade || '—'}</dd>
          <dt>Diagnóstico</dt><dd className="mono">{formatDate(tumor.diagnosis_date)}</dd>
        </dl>

        <div style={{ display: 'grid', gap: 8 }}>
          <span className="eyebrow">Biomarcadores</span>
          {tumor.biomarkers?.length ? (
            <div className="chip-row">
              {tumor.biomarkers.map((b) => (
                <span key={b.name} className="chip">{b.name} <strong style={{ fontWeight: 700 }}>{b.result}</strong></span>
              ))}
            </div>
          ) : <p style={{ color: 'var(--muted)' }}>Sin biomarcadores cargados.</p>}
        </div>

        {tumor.notes ? <p style={{ whiteSpace: 'pre-wrap' }}>{tumor.notes}</p> : null}
      </div>
    </div>
  );
}

function TumorEditor({ tumor, gender, onCancel, onSave, saving, error }) {
  const [form, setForm] = useState(() => toForm(tumor));
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const site = SITES[form.primary_site];
  const presets = BIOMARKER_PRESETS[form.primary_site] || [];
  const usedMarkers = new Set(form.biomarkers.map((b) => b.name));

  const selectSite = (code, laterality = 'na') => {
    const paired = SITES[code]?.paired;
    setForm({ ...form, primary_site: code, laterality: paired ? (laterality === 'na' ? 'right' : laterality) : 'na' });
  };

  const updateMarker = (index, field, value) => {
    const biomarkers = form.biomarkers.map((b, i) => (i === index ? { ...b, [field]: value } : b));
    setForm({ ...form, biomarkers });
  };

  const submit = (event) => {
    event.preventDefault();
    onSave(toPayload(form));
  };

  return (
    <form onSubmit={submit} className="tumor-layout">
      <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
        <AnatomyMap
          selected={form.primary_site ? { site: form.primary_site, laterality: form.laterality } : null}
          onSelect={selectSite}
          gender={gender}
        />
        <span className="eyebrow">Sin ubicación única</span>
        <div className="chip-row">
          {SYSTEMIC_SITES.map((code) => (
            <button
              key={code}
              type="button"
              className="chip-button"
              aria-pressed={form.primary_site === code}
              style={form.primary_site === code ? { background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'var(--danger)', borderStyle: 'solid' } : undefined}
              onClick={() => selectSite(code)}
            >
              {SITES[code].short}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <div>
          <span className="eyebrow">{tumor ? 'Editar tumor' : 'Nuevo tumor'}</span>
          <h2>{site ? site.label : 'Elegí la ubicación en el esquema'}</h2>
        </div>

        {site?.paired ? (
          <div className="segmented" role="group" aria-label="Lateralidad">
            {['right', 'left', 'bilateral'].map((value) => (
              <button key={value} type="button" aria-pressed={form.laterality === value} onClick={() => setForm({ ...form, laterality: value })}>
                {LATERALITY_LABELS[value]}
              </button>
            ))}
          </div>
        ) : null}

        <div className="form-grid">
          <label>
            Detalle de ubicación
            <input id="tumor-site-detail" value={form.site_detail} onChange={set('site_detail')} placeholder="Ej.: lóbulo superior, periférico" />
          </label>
          <label>
            Histología
            <input id="tumor-histology" value={form.histology} onChange={set('histology')} placeholder="Ej.: adenocarcinoma" />
          </label>
          <label>
            Tamaño (mm)
            <input id="tumor-size" type="number" min="1" max="999" value={form.size_mm} onChange={set('size_mm')} />
          </label>
          <label>
            Fecha de diagnóstico
            <input id="tumor-dx-date" type="date" value={form.diagnosis_date || ''} onChange={set('diagnosis_date')} />
          </label>
          <label>
            Grado
            <input id="tumor-grade" value={form.grade} onChange={set('grade')} placeholder="Ej.: G2, Gleason 7 (3+4)" />
          </label>
          <label>
            Estado
            <select id="tumor-status" value={form.status} onChange={set('status')}>
              {Object.entries(TUMOR_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <fieldset style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: 12, display: 'grid', gap: 10 }}>
          <legend className="eyebrow" style={{ padding: '0 6px' }}>Estadificación TNM (AJCC)</legend>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
            <label>
              Tipo
              <select id="tumor-tnm-prefix" value={form.tnm_prefix} onChange={set('tnm_prefix')}>
                {Object.entries(TNM_PREFIX_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {[['T', 't_category', T_OPTIONS], ['N', 'n_category', N_OPTIONS], ['M', 'm_category', M_OPTIONS]].map(([axis, field, options]) => (
              <label key={field}>
                {axis}
                <select id={`tumor-${field}`} value={form[field] || ''} onChange={set(field)}>
                  <option value="">—</option>
                  {options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ))}
            <label>
              Estadio
              <select id="tumor-stage" value={form.stage_group || ''} onChange={set('stage_group')}>
                <option value="">—</option>
                {STAGE_GROUPS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            El estadio no se calcula automáticamente: las reglas AJCC cambian según el órgano. Elegilo según la tabla correspondiente.
          </p>
        </fieldset>

        <div style={{ display: 'grid', gap: 8 }}>
          <span className="eyebrow">Biomarcadores</span>
          {presets.length ? (
            <div className="chip-row">
              {presets.filter((name) => !usedMarkers.has(name)).map((name) => (
                <button key={name} type="button" className="chip-button" onClick={() => setForm({ ...form, biomarkers: [...form.biomarkers, { name, result: '' }] })}>
                  + {name}
                </button>
              ))}
            </div>
          ) : null}
          {form.biomarkers.map((marker, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto', gap: 8 }}>
              <input aria-label="Biomarcador" value={marker.name} onChange={(e) => updateMarker(index, 'name', e.target.value)} placeholder="Nombre" />
              <input aria-label={`Resultado de ${marker.name || 'biomarcador'}`} value={marker.result} onChange={(e) => updateMarker(index, 'result', e.target.value)} placeholder="Resultado (ej.: positivo, 60%)" />
              <button type="button" className="ghost" aria-label={`Quitar ${marker.name}`} onClick={() => setForm({ ...form, biomarkers: form.biomarkers.filter((_, i) => i !== index) })}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button type="button" className="chip-button" style={{ justifySelf: 'start' }} onClick={() => setForm({ ...form, biomarkers: [...form.biomarkers, { name: '', result: '' }] })}>
            + Otro biomarcador
          </button>
        </div>

        <label>
          Notas
          <textarea id="tumor-notes" rows="3" value={form.notes} onChange={set('notes')} />
        </label>

        {error ? <div className="message message--error" role="alert">{error}</div> : null}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={saving || !form.primary_site}>{saving ? 'Guardando…' : 'Guardar tumor'}</button>
          <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </form>
  );
}

export default function TumorTab({ tumors, gender, canWrite, onSaveTumor }) {
  const [selectedId, setSelectedId] = useState(tumors[0]?.id || null);
  const [editing, setEditing] = useState(tumors.length === 0 && canWrite ? 'new' : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selected = tumors.find((tumor) => tumor.id === selectedId) || tumors[0] || null;

  const save = async (payload) => {
    setSaving(true);
    setError('');
    try {
      const saved = await onSaveTumor(editing === 'new' ? null : selected.id, payload);
      setSelectedId(saved.id);
      setEditing(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {tumors.length > 1 || (tumors.length && canWrite) ? (
        <div className="toolbar">
          <div className="chip-row" role="tablist" aria-label="Tumores del paciente">
            {tumors.map((tumor) => (
              <button
                key={tumor.id}
                type="button"
                role="tab"
                aria-selected={tumor.id === selected?.id && editing !== 'new'}
                className="chip-button"
                style={tumor.id === selected?.id && editing !== 'new' ? { background: 'var(--accent)', color: '#fff', borderStyle: 'solid', borderColor: 'var(--accent)' } : undefined}
                onClick={() => { setSelectedId(tumor.id); setEditing(null); }}
              >
                {siteLabel(tumor)}
              </button>
            ))}
          </div>
          {canWrite && editing !== 'new' ? (
            <button type="button" className="secondary icon-button" onClick={() => setEditing('new')}>
              <Plus size={15} aria-hidden="true" /> Otro tumor
            </button>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <TumorEditor
          key={editing === 'new' ? 'new' : selected.id}
          tumor={editing === 'new' ? null : selected}
          gender={gender}
          onCancel={() => { setEditing(null); setError(''); }}
          onSave={save}
          saving={saving}
          error={error}
        />
      ) : selected ? (
        <TumorView tumor={selected} gender={gender} canWrite={canWrite} onEdit={() => setEditing(selected.id)} />
      ) : (
        <div className="empty-state">Todavía no hay tumores cargados para este paciente.</div>
      )}
    </div>
  );
}
