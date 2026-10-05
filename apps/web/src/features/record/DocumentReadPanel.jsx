import { useMemo, useState } from 'react';
import { ShieldAlert, Sparkles, X } from 'lucide-react';
import { apiJson } from '../../lib/api';
import { LATERALITY_LABELS, SITES, formatDate, siteLabel } from './catalog';

const TUMOR_FIELDS = [
  ['primary_site', 'Ubicación', (v) => SITES[v]?.label || v],
  ['laterality', 'Lateralidad', (v) => LATERALITY_LABELS[v] || v],
  ['histology', 'Histología'],
  ['size_mm', 'Tamaño', (v) => `${v} mm`],
  ['t_category', 'T'],
  ['n_category', 'N'],
  ['m_category', 'M'],
  ['stage_group', 'Estadio'],
  ['grade', 'Grado'],
];

const TYPE_LABELS = { patologia: 'Anatomía patológica', imagenes: 'Imágenes', laboratorio: 'Laboratorio', epicrisis: 'Epicrisis', otro: 'Documento' };

// Propuestas de la IA → el médico elige qué aplicar a la ficha.
function Proposals({ extraction, tumors, canWrite, onSaveTumor }) {
  const proposedFields = TUMOR_FIELDS.filter(([key]) => extraction.extracted.tumor?.[key] != null);
  const biomarkers = extraction.extracted.biomarkers || [];
  const [selected, setSelected] = useState(() => new Set([...proposedFields.map(([key]) => key), ...biomarkers.map((b) => `bm:${b.name}`)]));
  const [target, setTarget] = useState(tumors.find((t) => t.is_primary)?.id || tumors[0]?.id || 'new');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  if (!proposedFields.length && !biomarkers.length) {
    return <p style={{ color: 'var(--muted)' }}>No se encontraron datos estructurados para proponer.</p>;
  }

  const toggle = (key) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const apply = async () => {
    const tumor = target === 'new' ? null : tumors.find((t) => t.id === target);
    const fields = Object.fromEntries(proposedFields.filter(([key]) => selected.has(key)).map(([key]) => [key, extraction.extracted.tumor[key]]));
    const pickedMarkers = biomarkers.filter((b) => selected.has(`bm:${b.name}`));

    if (!tumor && !fields.primary_site) {
      setMessage({ type: 'error', text: 'Para crear un tumor nuevo hace falta la ubicación.' });
      return;
    }

    const merged = new Map((tumor?.biomarkers || []).map((b) => [b.name, b]));
    pickedMarkers.forEach((b) => merged.set(b.name, b));
    const payload = {
      ...fields,
      ...(fields.primary_site && !fields.laterality ? { laterality: SITES[fields.primary_site]?.paired ? 'right' : 'na' } : {}),
      ...(pickedMarkers.length ? { biomarkers: [...merged.values()] } : {}),
      ...(!tumor && extraction.extracted.document_date && extraction.extracted.document_type === 'patologia' ? { diagnosis_date: extraction.extracted.document_date } : {}),
    };

    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await onSaveTumor(tumor?.id || null, payload);
      setMessage({ type: 'success', text: tumor ? 'Datos aplicados al tumor. Revisalos en la pestaña Tumor.' : 'Tumor creado con los datos elegidos.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <span className="eyebrow">Datos propuestos para la ficha</span>
      <div className="proposal-list">
        {proposedFields.map(([key, label, format]) => (
          <label key={key} className="proposal">
            <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} disabled={!canWrite} />
            <span>{label}</span>
            <strong>{format ? format(extraction.extracted.tumor[key]) : extraction.extracted.tumor[key]}</strong>
          </label>
        ))}
        {biomarkers.map((b) => (
          <label key={b.name} className="proposal">
            <input type="checkbox" checked={selected.has(`bm:${b.name}`)} onChange={() => toggle(`bm:${b.name}`)} disabled={!canWrite} />
            <span>{b.name}</span>
            <strong>{b.result}</strong>
          </label>
        ))}
      </div>
      {canWrite ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ minWidth: 200 }}>
            Aplicar a
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {tumors.map((t) => <option key={t.id} value={t.id}>{siteLabel(t)}</option>)}
              <option value="new">Tumor nuevo</option>
            </select>
          </label>
          <button type="button" disabled={saving || selected.size === 0} onClick={apply}>
            {saving ? 'Aplicando…' : 'Aplicar a la ficha'}
          </button>
        </div>
      ) : null}
      {message.text ? <div className={`message message--${message.type === 'success' ? 'success' : 'error'}`}>{message.text}</div> : null}
    </div>
  );
}

export default function DocumentReadPanel({ patientId, attachment, previous, tumors, canWrite, onSaveTumor, onClose, onRead }) {
  const [extraction, setExtraction] = useState(previous || null);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(null);
  const [error, setError] = useState('');
  const confidenceClass = useMemo(() => ({ alta: '', media: 'chip--warn', baja: 'chip--alert' }[extraction?.extracted?.confidence] ?? 'chip--muted'), [extraction]);

  const read = async (allowFileUpload = false) => {
    setLoading(true);
    setError('');
    try {
      const saved = await apiJson(`/patients/${patientId}/attachments/${attachment.id}/read`, {
        method: 'POST',
        body: JSON.stringify({ allowFileUpload }),
      });
      setExtraction(saved);
      setConsent(null);
      onRead?.(saved);
    } catch (err) {
      if (err.status === 409) setConsent(err.message);
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="read-panel" aria-label={`Lectura con IA de ${attachment.file_name}`}>
      <div className="toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={18} color="var(--teal)" aria-hidden="true" />
          <div>
            <span className="eyebrow">Lectura con IA</span>
            <h3 style={{ overflowWrap: 'anywhere' }}>{attachment.file_name}</h3>
          </div>
        </div>
        <button type="button" className="secondary" aria-label="Cerrar lectura" onClick={onClose}><X size={16} /></button>
      </div>

      {!extraction && !consent ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            Si es un PDF con texto, se extrae y anonimiza en el servidor antes de enviarlo a la IA. Las imágenes y los PDF escaneados piden permiso aparte.
          </p>
          <button type="button" style={{ justifySelf: 'start' }} disabled={loading} onClick={() => read(false)}>
            {loading ? 'Leyendo el documento…' : 'Leer documento'}
          </button>
        </div>
      ) : null}

      {consent ? (
        <div className="consent-box" role="alertdialog" aria-label="Permiso para enviar el archivo">
          <ShieldAlert size={20} aria-hidden="true" />
          <div style={{ display: 'grid', gap: 8 }}>
            <p>{consent}</p>
            <p style={{ fontSize: '0.85rem' }}>El envío queda registrado en la auditoría.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" disabled={loading} onClick={() => read(true)}>{loading ? 'Enviando…' : 'Enviar el archivo completo'}</button>
              <button type="button" className="secondary" onClick={() => setConsent(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="message message--error" role="alert">{error}</div> : null}

      {extraction ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="chip-row">
            <span className="ai-badge">Borrador · verificar con el documento</span>
            <span className="chip chip--teal">{TYPE_LABELS[extraction.extracted.document_type]}</span>
            {extraction.extracted.document_date ? <span className="chip chip--muted">{formatDate(extraction.extracted.document_date)}</span> : null}
            <span className={`chip ${confidenceClass}`}>Confianza {extraction.extracted.confidence}</span>
            {extraction.method === 'image' ? <span className="chip chip--warn">Archivo enviado completo</span> : null}
          </div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{extraction.summary}</p>
          {extraction.extracted.findings?.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
              {extraction.extracted.findings.map((finding) => <li key={finding}>{finding}</li>)}
            </ul>
          ) : null}
          <Proposals extraction={extraction} tumors={tumors} canWrite={canWrite} onSaveTumor={onSaveTumor} />
          <p className="ai-msg__source">Leído el {formatDate(extraction.created_at)} · {extraction.model}</p>
        </div>
      ) : null}
    </section>
  );
}
