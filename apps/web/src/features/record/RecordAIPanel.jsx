import { forwardRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { apiJson } from '../../lib/api';

const QUICK_PROMPTS = [
  { label: 'Resumir el caso', kind: 'chat', text: 'Resumí el caso en 5 líneas: diagnóstico, estadio, tratamientos y estado actual.' },
  { label: 'Próximos pasos', kind: 'recommendations', text: 'Sugerí próximos pasos de manejo según el estadio y los biomarcadores cargados.' },
  { label: '¿Qué falta?', kind: 'chat', text: '¿Qué información clínica falta en la ficha para tomar la próxima decisión terapéutica?' },
];

const SOURCE_NOTE = 'Basado en los datos de esta ficha. Todavía no hay guías clínicas conectadas.';

// Asistente dentro de la ficha. Cada respuesta es un borrador para el médico.
const RecordAIPanel = forwardRef(function RecordAIPanel({ patientId, enabled, disabledReason }, inputRef) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const send = async (text, kind = 'chat') => {
    const message = text.trim();
    if (!message || loading) return;
    setError('');
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setDraft('');
    setLoading(true);
    try {
      const result = kind === 'recommendations'
        ? await apiJson('/ai/recommendations', { method: 'POST', body: JSON.stringify({ patientId, clinicalQuestion: message }) })
        : await apiJson('/ai/chat', { method: 'POST', body: JSON.stringify({ patientId, message, history }) });
      const answer = result.recommendations || result.answer || 'La IA no devolvió respuesta.';
      setMessages((current) => [...current, { role: 'assistant', content: answer, provider: result.provider }]);
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
                    <div className="ai-msg__source">
                      {message.provider === 'fallback' ? 'Gemini no está configurado en el servidor.' : SOURCE_NOTE}
                    </div>
                  ) : null}
                </div>
              ))}
              {loading ? <div className="ai-msg ai-msg--assistant" style={{ color: 'var(--muted)' }}>Pensando…</div> : null}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
              La IA recibe diagnóstico, TNM, biomarcadores, tratamientos y eventos recientes, sin nombre ni DNI del paciente.
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
