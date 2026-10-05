import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../../lib/api';
import AuthorizationCard, { AUTH_STATUS } from './AuthorizationCard';

const COLUMNS = ['draft', 'submitted', 'observed', 'approved', 'rejected'];

// Tablero de autorizaciones de todos los pacientes visibles, por estado.
export default function AuthorizationsBoard({ canWrite }) {
  const [items, setItems] = useState(null);
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson('/authorizations').then(setItems).catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || []).filter((a) => (!onlyAlerts || a.expiry || a.status === 'observed')
      && (!q || a.item.toLowerCase().includes(q) || (a.patient?.full_name || '').toLowerCase().includes(q) || (a.payer?.name || '').toLowerCase().includes(q)));
  }, [items, onlyAlerts, query]);

  const alerts = (items || []).filter((a) => a.expiry || a.status === 'observed').length;

  if (error) return <div className="message message--error">{error}</div>;
  if (!items) return <p style={{ color: 'var(--muted)' }}>Cargando autorizaciones…</p>;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="toolbar">
        <input type="search" aria-label="Buscar autorización" placeholder="Buscar por paciente, droga u obra social" value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 380 }} />
        <button type="button" className={onlyAlerts ? '' : 'secondary'} aria-pressed={onlyAlerts} onClick={() => setOnlyAlerts(!onlyAlerts)}>
          Requieren atención ({alerts})
        </button>
      </div>
      <div className="auth-board">
        {COLUMNS.map((status) => {
          const column = filtered.filter((a) => a.status === status);
          return (
            <section key={status} className="auth-board__col" aria-label={AUTH_STATUS[status].label}>
              <h3>{AUTH_STATUS[status].label} <span className="mono">{column.length}</span></h3>
              {column.map((a) => (
                <AuthorizationCard key={a.id} authorization={a} canWrite={canWrite} showPatient onChanged={(saved) => setItems((current) => current.map((x) => (x.id === saved.id ? { ...x, ...saved } : x)))} />
              ))}
            </section>
          );
        })}
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Las autorizaciones nuevas se piden desde la ficha del paciente (pestaña Cobertura) o, en secretaría, desde Pacientes → Cobertura.</p>
    </div>
  );
}
