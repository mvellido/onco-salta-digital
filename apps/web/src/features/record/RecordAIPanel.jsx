import { forwardRef, useEffect, useState } from 'react';
import { BookOpen, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { apiJson } from '../../lib/api';
import { formatDate } from './catalog';

const QUICK_PROMPTS = [
  { label: 'Resumir el caso', kind: 'chat', text: 'Resumí el caso en 5 líneas: diagnóstico, estadio, tratamientos y estado actual.' },
  { label: 'Próximos pasos', kind: 'recommendations', text: 'Sugerí próximos pasos de manejo según el estadio y los biomarcadores cargados.' },
  { label: '¿Qué falta?', kind: 'chat', text: '¿Qué información clínica falta en la ficha para tomar la próxima decisión terapéutica?' },
];

function toMessages(interactions) {
  return [...interactions].reverse().flatMap((item) => [
    { role: 'user', content: item.question, at: item.created_at },
    { role: 'assistant', content: item.answer, sources: item.sources || [], redactions: item.redactions, provider: item.provider, at: item.created_at },
  ]);
}

async function openSource(source) {
  // Se abre la ventana antes del pedido para que el navegador no la bloquee.
  const tab = window.open('', '_blank');
  if (!tab) return;
  tab.opener = null;
  try {
    const { url } = await apiJson(`/guidelines/${source.guideline_id}/url?page=${source.page}`);
    tab.location.href = url;
  } catch {
    tab.close();
  }
}

function Sources({ sources }) {
  if (!sources?.length) {
    return <div className="ai-msg__source">Sin citas de la biblioteca de guías: tomalo como orientación general.</div>;
  }
  return (
    <div className="ai-sources">
      {sources.map((source) => (
        <button key={source.n} type="button" className="ai-source" onClick={() => openSource(source)} title="Abrir la guía en esa página">
          <BookOpen size={13} aria-hidden="true" />
          <span>[{source.n}] {source.title}{source.organization ? ` · ${source.organization}` : ''}{source.version ? ` ${source.version}` : ''}</span>
          <strong>pág. {source.page}</strong>
        </button>
      ))}
    </div>
  );
}

// Asistente dentro de la ficha. Cada respuesta es un borrador para el médico.
const RecordAIPanel = forwardRef(function RecordAIPanel({ patientId, enabled, disabledReason }, inputRef) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    apiJson(`/patients/${patientId}/ai-history`)
      .then((items) => { if (!cancelled) setMessages(toMessages(items)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [patientId, enabled]);

  const send = async (text, kind = 'chat') => {
    const message = text.trim();
    if (!message || loading) return;
    setError('');
    const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    setMessages((current) => [...current, { role: 'user', content: message, at: new Date().toISOString() }]);
    setDraft('');
    setLoading(true);
    try {
      const result = kind === 'recommendations'
        ? await apiJson('/ai/recommendations', { method: 'POST', body: JSON.stringify({ patientId, clinicalQuestion: message }) })
        : await apiJson('/ai/chat', { method: 'POST', body: JSON.stringify({ patientId, message, history }) });
      setMessages((current) => [...current, {
        role: 'assistant',
        content: result.answer || result.recommendations || 'La IA no devolvió respuesta.',
        sources: result.sources || [],
        redactions: result.redactions || 0,
        provider: result.provider,
        at: new Date().toISOString(),
      }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="side-card ai-panel" aria-label="Asistente IA">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkles size={18} color="var(--teal)" aria-hidden="true" />
        <h2>Asistente IA</h2>
      </div>
      <span className="ai-badge">Borrador · requiere validación médica</span>

      {!enabled ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{disabledReason}</p>
      ) : (
        <>
          <div className="chip-row">
            {QUICK_PROMPTS.map((prompt) => (
              <button key={prompt.label} type="button" className="chip-button" disabled={loading} onClick={() => send(prompt.text, prompt.kind)}>
                {prompt.label}
              </button>
            ))}
          </div>

          {messages.length ? (
            <div className="ai-thread" aria-live="polite">
              {messages.map((message, index) => (
                <div key={index} className={`ai-msg ai-msg--${message.role}`}>
                  {message.content}
                  {message.role === 'assistant' ? (
                    message.provider === 'fallback'
                      ? <div className="ai-msg__source">Gemini no está configurado en el servidor.</div>
                      : (
                        <>
                          <Sources sources={message.sources} />
                          <div className="ai-msg__source">
                            {formatDate(message.at)}
                            {message.redactions ? <> · <ShieldCheck size={11} aria-hidden="true" /> {message.redactions} datos personales ocultos</> : null}
                          </div>
                        </>
                      )
                  ) : null}
                </div>
              ))}
              {loading ? <div className="ai-msg ai-msg--assistant" style={{ color: 'var(--muted)' }}>Buscando en las guías y pensando…</div> : null}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
              La IA recibe diagnóstico, TNM, biomarcadores, tratamientos y eventos, sin nombre, DNI ni contacto. Responde citando la biblioteca de guías del centro.
            </p>
          )}

          {error ? <div className="message message--error" role="alert">{error}</div> : null}

          <form className="ai-compose" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
            <label className="visually-hidden" htmlFor="ai-input">Pregunta para la IA</label>
            <textarea
              id="ai-input"
              ref={inputRef}
              rows="2"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder="Consultar sobre este caso…"
            />
            <button type="submit" aria-label="Enviar pregunta" disabled={loading || !draft.trim()}>
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </>
      )}
    </aside>
  );
});

export default RecordAIPanel;
