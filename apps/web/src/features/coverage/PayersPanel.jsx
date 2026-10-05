import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiJson } from '../../lib/api';
import { PAYER_KINDS } from './AuthorizationCard';

const EMPTY = { name: '', kind: 'obra_social', rnos: '', cuit: '', contact: '' };

export default function PayersPanel({ canWrite }) {
  const [payers, setPayers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const load = useCallback(() => apiJson('/payers?all=true').then(setPayers).catch((err) => setMessage({ type: 'error', text: err.message })), []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const save = async (event) => {
    event.preventDefault();
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== ''));
      const saved = await apiJson('/payers', { method: 'POST', body: JSON.stringify(body) });
      setForm(EMPTY);
      setAdding(false);
      setMessage({ type: 'success', text: `${saved.name} agregada.` });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const toggle = async (payer) => {
    try {
      await apiJson(`/payers/${payer.id}`, { method: 'PATCH', body: JSON.stringify({ active: !payer.active }) });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="toolbar">
        <div>
          <h2>Obras sociales y prepagas</h2>
          <p style={{ color: 'var(--muted)' }}>Financiadores con los que trabaja el centro.</p>
        </div>
        {canWrite && !adding ? (
          <button type="button" className="icon-button" onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden="true" /> Agregar obra social
          </button>
        ) : null}
      </div>

      {canWrite && adding ? (
        <form onSubmit={save} style={{ display: 'grid', gap: 10, padding: 14, border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-solid)' }}>
          <strong>Nueva obra social o prepaga</strong>
          <div className="form-grid">
            <label>Nombre<input id="payer-name" required minLength={2} autoFocus value={form.name} onChange={set('name')} /></label>
            <label>
              Tipo
              <select id="payer-kind" value={form.kind} onChange={set('kind')}>
                {Object.entries(PAYER_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>RNOS<input id="payer-rnos" value={form.rnos} onChange={set('rnos')} placeholder="Código de la SSSalud" /></label>
            <label>CUIT<input id="payer-cuit" value={form.cuit} onChange={set('cuit')} /></label>
            <label>Contacto para autorizaciones<input id="payer-contact" value={form.contact} onChange={set('contact')} placeholder="Email, portal o teléfono" /></label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={form.name.trim().length < 2}>Guardar</button>
            <button type="button" className="secondary" onClick={() => { setAdding(false); setForm(EMPTY); }}>Cancelar</button>
          </div>
        </form>
      ) : null}

      {message.text ? <div className={`message message--${message.type === 'success' ? 'success' : 'error'}`}>{message.text}</div> : null}

      {payers.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Tipo</th><th>RNOS</th><th>Contacto</th><th><span className="visually-hidden">Acciones</span></th></tr></thead>
            <tbody>
              {payers.map((p) => (
                <tr key={p.id} style={p.active ? undefined : { opacity: 0.55 }}>
                  <td><strong>{p.name}</strong></td>
                  <td>{PAYER_KINDS[p.kind]}</td>
                  <td className="mono">{p.rnos || '—'}</td>
                  <td>{p.contact || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{canWrite ? <button type="button" className="secondary" onClick={() => toggle(p)}>{p.active ? 'Desactivar' : 'Activar'}</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !adding ? (
        <div className="empty-state">
          Todavía no hay obras sociales cargadas.
          {canWrite ? <button type="button" className="icon-button" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" /> Agregar la primera</button> : null}
        </div>
      ) : null}
    </div>
  );
}
