import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Upload } from 'lucide-react';
import { apiJson } from '../../lib/api';
import { supabase } from '../../app/supabaseClient';

const STATUS = {
  pending: { label: 'Subiendo', className: 'chip--muted' },
  processing: { label: 'Procesando', className: 'chip--warn' },
  ready: { label: 'Lista', className: '' },
  failed: { label: 'Falló', className: 'chip--alert' },
};

const EMPTY = { title: '', organization: '', version: '', published_on: '', license_note: '' };

export default function GuidelinesPanel() {
  const [guidelines, setGuidelines] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    try {
      setGuidelines(await apiJson('/guidelines'));
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const processGuideline = async (id) => {
    setStep('Leyendo el PDF y preparando la búsqueda… (puede tardar un minuto)');
    const processed = await apiJson(`/guidelines/${id}/process`, { method: 'POST' });
    return processed;
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setMessage({ type: '', text: '' });
    try {
      setStep('Registrando la guía…');
      const body = Object.fromEntries(Object.entries({ ...form, fileName: file.name }).filter(([, value]) => value !== ''));
      const { guideline, bucket, path, signedUpload } = await apiJson('/guidelines', { method: 'POST', body: JSON.stringify(body) });

      setStep('Subiendo el PDF…');
      const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, signedUpload.token, file, { contentType: 'application/pdf' });
      if (error) throw new Error('No se pudo subir el archivo. Probá de nuevo.');

      const processed = await processGuideline(guideline.id);
      setMessage({ type: 'success', text: `"${processed.title}" lista: ${processed.page_count} páginas, ${processed.chunk_count} fragmentos para búsqueda.` });
      setForm(EMPTY);
      setFile(null);
      event.target.reset();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
      setStep('');
      load();
    }
  };

  const retry = async (guideline) => {
    setBusy(true);
    setMessage({ type: '', text: '' });
    try {
      await processGuideline(guideline.id);
      setMessage({ type: 'success', text: `"${guideline.title}" procesada.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
      setStep('');
      load();
    }
  };

  const toggleActive = async (guideline) => {
    try {
      await apiJson(`/guidelines/${guideline.id}`, { method: 'PATCH', body: JSON.stringify({ active: !guideline.active }) });
      load();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  return (
    <section className="section-card" style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <BookOpen size={22} color="var(--teal)" aria-hidden="true" />
        <div>
          <h2>Biblioteca de guías</h2>
          <p style={{ color: 'var(--muted)' }}>La IA solo cita lo que está acá, con documento y página.</p>
        </div>
      </div>

      <div className="message" style={{ background: 'var(--teal-soft)', borderColor: '#b9dbe1', color: 'var(--ink)' }}>
        Subí solo guías que el centro tiene derecho a usar: protocolos propios o guías de acceso abierto (por ejemplo, ESMO, respetando su licencia).
        Las guías NCCN requieren licencia para este uso.
      </div>

      <form onSubmit={handleUpload} style={{ display: 'grid', gap: 10 }}>
        <div className="form-grid">
          <label>Título<input id="gl-title" required minLength={3} value={form.title} onChange={set('title')} placeholder="Ej.: CPNM metastásico" /></label>
          <label>Organización<input id="gl-org" value={form.organization} onChange={set('organization')} placeholder="Ej.: ESMO, protocolo del servicio" /></label>
          <label>Versión<input id="gl-version" value={form.version} onChange={set('version')} placeholder="Ej.: 2025" /></label>
          <label>Publicada<input id="gl-date" type="date" value={form.published_on} onChange={set('published_on')} /></label>
        </div>
        <label>Licencia o permiso<input id="gl-license" value={form.license_note} onChange={set('license_note')} placeholder="Ej.: CC BY-NC-ND 4.0, uso interno autorizado" /></label>
        <label>
          Archivo PDF (con texto, no escaneado)
          <input id="gl-file" type="file" accept="application/pdf" required onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <button type="submit" className="icon-button" style={{ justifySelf: 'start' }} disabled={busy || !file || form.title.trim().length < 3}>
          <Upload size={16} aria-hidden="true" /> {busy ? 'Procesando…' : 'Subir y procesar'}
        </button>
        {step ? <p style={{ color: 'var(--muted)' }} aria-live="polite">{step}</p> : null}
      </form>

      {message.text ? <div className={`message message--${message.type === 'success' ? 'success' : 'error'}`}>{message.text}</div> : null}

      {guidelines.length ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {guidelines.map((g) => (
            <div key={g.id} className="guideline-row">
              <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                <strong style={{ overflowWrap: 'anywhere' }}>{g.title}</strong>
                <div className="chip-row">
                  <span className={`chip ${STATUS[g.status].className}`}>{STATUS[g.status].label}</span>
                  {[g.organization, g.version].filter(Boolean).length ? <span className="chip chip--muted">{[g.organization, g.version].filter(Boolean).join(' ')}</span> : null}
                  {g.status === 'ready' ? <span className="chip chip--muted">{g.page_count} págs · {g.chunk_count} fragmentos</span> : null}
                  {!g.active ? <span className="chip chip--warn">Desactivada</span> : null}
                </div>
                {g.error ? <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{g.error}</p> : null}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {g.status !== 'ready' ? <button type="button" className="secondary" disabled={busy} onClick={() => retry(g)}>Reprocesar</button> : null}
                <button type="button" className="secondary" onClick={() => toggleActive(g)}>{g.active ? 'Desactivar' : 'Activar'}</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">Todavía no hay guías. Mientras tanto, la IA responde sin citas y lo aclara.</div>
      )}
    </section>
  );
}
