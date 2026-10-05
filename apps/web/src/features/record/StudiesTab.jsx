import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, FileText, Sparkles, X } from 'lucide-react';
import { supabase } from '../../app/supabaseClient';
import { apiJson } from '../../lib/api';
import { formatDate } from './catalog';
import DocumentReadPanel from './DocumentReadPanel';

const BUCKET = 'medical-history';

const isImage = (a) => (a.content_type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a.file_name || '');
const isPdf = (a) => a.content_type === 'application/pdf' || /\.pdf$/i.test(a.file_name || '');

// Galería de estudios: todos los adjuntos de la historia clínica del paciente.
// `preloaded` permite mostrar adjuntos ya resueltos (con `url`) sin consultar Storage.
export default function StudiesTab({ events, preloaded = null, patientId, canUseAI = false, canWrite = false, tumors = [], onSaveTumor }) {
  const [attachments, setAttachments] = useState(preloaded || []);
  const [urls, setUrls] = useState(() => Object.fromEntries((preloaded || []).map((a) => [a.id, a.url])));
  const [loading, setLoading] = useState(!preloaded);
  const [error, setError] = useState('');
  const [openIndex, setOpenIndex] = useState(null);
  const [extractions, setExtractions] = useState({});
  const [reading, setReading] = useState(null);

  useEffect(() => {
    if (!canUseAI || preloaded || !patientId) return undefined;
    let cancelled = false;
    apiJson(`/patients/${patientId}/extractions`)
      .then((rows) => {
        if (cancelled) return;
        const latest = {};
        rows.forEach((row) => { if (!latest[row.attachment_id]) latest[row.attachment_id] = row; });
        setExtractions(latest);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [canUseAI, preloaded, patientId]);

  const eventIds = useMemo(() => events.map((event) => event.id), [events]);
  const eventById = useMemo(() => Object.fromEntries(events.map((event) => [event.id, event])), [events]);

  useEffect(() => {
    if (preloaded) return undefined;
    let cancelled = false;

    (async () => {
      if (!eventIds.length) {
        setAttachments([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error: dbError } = await supabase
        .from('event_attachments')
        .select('*')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (dbError) {
        setError('No se pudieron cargar los estudios.');
        setLoading(false);
        return;
      }

      setAttachments(data || []);
      const paths = (data || []).map((a) => a.storage_path);
      if (paths.length) {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
        if (!cancelled && signed) {
          const byPath = Object.fromEntries(signed.map((item) => [item.path, item.signedUrl]));
          setUrls(Object.fromEntries((data || []).map((a) => [a.id, byPath[a.storage_path]])));
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [eventIds, preloaded]);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback((delta) => {
    setOpenIndex((index) => (index === null ? null : (index + delta + attachments.length) % attachments.length));
  }, [attachments.length]);

  useEffect(() => {
    if (openIndex === null) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openIndex, close, step]);

  if (loading) return <p style={{ color: 'var(--muted)' }}>Cargando estudios…</p>;
  if (error) return <div className="message message--error">{error}</div>;
  if (!attachments.length) {
    return <div className="empty-state">No hay estudios adjuntos. Se suben desde la pestaña Historia, dentro de cada evento.</div>;
  }

  const open = openIndex !== null ? attachments[openIndex] : null;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <span className="eyebrow">{attachments.length} estudios adjuntos</span>
      {reading ? (
        <DocumentReadPanel
          key={reading.id}
          patientId={patientId}
          attachment={reading}
          previous={extractions[reading.id]}
          tumors={tumors}
          canWrite={canWrite}
          onSaveTumor={onSaveTumor}
          onClose={() => setReading(null)}
          onRead={(saved) => setExtractions((current) => ({ ...current, [reading.id]: saved }))}
        />
      ) : null}
      <div className="study-grid">
        {attachments.map((attachment, index) => {
          const event = eventById[attachment.event_id];
          const readable = canUseAI && (isImage(attachment) || isPdf(attachment));
          const done = Boolean(extractions[attachment.id]);
          return (
            <div key={attachment.id} className="study-tile">
            <button type="button" className="study-tile__open" onClick={() => setOpenIndex(index)} aria-label={`Ver ${attachment.file_name}`}>
              <div className="study-tile__media">
                {isImage(attachment) && urls[attachment.id]
                  ? <img src={urls[attachment.id]} alt="" loading="lazy" />
                  : <FileText size={34} aria-hidden="true" />}
              </div>
              <div className="study-tile__caption">
                <strong style={{ overflowWrap: 'anywhere' }}>{attachment.file_name}</strong>
                <span>{event ? `${event.event_type} · ${formatDate(event.event_date)}` : formatDate(attachment.created_at)}</span>
              </div>
            </button>
            {readable ? (
              <button type="button" className={`study-tile__read${done ? ' study-tile__read--done' : ''}`} onClick={() => setReading(attachment)}>
                {done ? <CheckCircle2 size={14} aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
                {done ? 'Leído · ver datos' : 'Leer con IA'}
              </button>
            ) : null}
            </div>
          );
        })}
      </div>

      {open ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={open.file_name}>
          <div className="lightbox__bar">
            <strong style={{ overflowWrap: 'anywhere' }}>{open.file_name}</strong>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="secondary" aria-label="Anterior" onClick={() => step(-1)}><ChevronLeft size={18} /></button>
              <button type="button" className="secondary" aria-label="Siguiente" onClick={() => step(1)}><ChevronRight size={18} /></button>
              <button type="button" className="secondary" aria-label="Cerrar (Esc)" onClick={close} autoFocus><X size={18} /></button>
            </div>
          </div>
          <div className="lightbox__body">
            {isImage(open) ? <img src={urls[open.id]} alt={open.file_name} />
              : isPdf(open) ? <iframe src={urls[open.id]} title={open.file_name} />
                : <a href={urls[open.id]} target="_blank" rel="noreferrer" style={{ color: '#e8f2ef' }}>Abrir archivo</a>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
