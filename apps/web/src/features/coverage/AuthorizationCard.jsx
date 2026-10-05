import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiJson } from '../../lib/api';
import { formatDate } from '../record/catalog';

export const AUTH_STATUS = {
  draft: { label: 'Borrador', chip: 'chip--muted' },
  submitted: { label: 'Presentada', chip: 'chip--teal' },
  observed: { label: 'Observada', chip: 'chip--warn' },
  approved: { label: 'Aprobada', chip: '' },
  rejected: { label: 'Rechazada', chip: 'chip--alert' },
};

export const PAYER_KINDS = {
  obra_social: 'Obra social',
  prepaga: 'Prepaga',
  pami: 'PAMI',
  art: 'ART',
  particular: 'Particular',
  otro: 'Otro',
};

// Tarjeta de autorización con las acciones que corresponden a su estado.
export default function AuthorizationCard({ authorization, canWrite, showPatient = false, onChanged }) {
  const [mode, setMode] = useState(null);
  const [number, setNumber] = useState(authorization.authorization_number || '');
  const [validUntil, setValidUntil] = useState(authorization.valid_until || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const status = AUTH_STATUS[authorization.status];

  const update = async (changes) => {
    setBusy(true);
    setError('');
    try {
      const saved = await apiJson(`/authorizations/${authorization.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
      setMode(null);
      onChanged(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const appendNote = (prefix) => [authorization.notes, note.trim() && `${prefix}: ${note.trim()}`].filter(Boolean).join('\n') || null;

  return (
    <article className={`auth-card${authorization.expiry ? ` auth-card--${authorization.expiry}` : ''}`}>
      <div className="toolbar" style={{ alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
          {showPatient ? <span className="eyebrow">{authorization.patient?.full_name}</span> : null}
          <strong style={{ overflowWrap: 'anywhere' }}>{authorization.item}</strong>
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            {authorization.payer?.name}{authorization.quantity ? ` · ${authorization.quantity}` : ''}
          </span>
        </div>
        <span className={`chip ${status.chip}`}>{status.label}</span>
      </div>

      <div className="auth-card__meta mono">
        {authorization.requested_on ? <span>Presentada {formatDate(authorization.requested_on)}</span> : null}
        {authorization.authorization_number ? <span>N.º {authorization.authorization_number}</span> : null}
        {authorization.valid_until ? <span>Vence {formatDate(authorization.valid_until)}</span> : null}
      </div>

      {authorization.expiry ? (
        <p className="auth-card__alert">
          <AlertTriangle size={14} aria-hidden="true" />
          {authorization.expiry === 'expired' ? 'Vencida: hay que renovarla antes de aplicar.' : `Vence en ${authorization.days_left} días.`}
        </p>
      ) : null}

      {authorization.notes ? <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--muted)' }}>{authorization.notes}</p> : null}

      {canWrite && mode === 'approve' ? (
        <form className="auth-card__form" onSubmit={(e) => { e.preventDefault(); update({ status: 'approved', authorization_number: number.trim(), valid_until: validUntil || null }); }}>
          <label>N.º de autorización<input required value={number} onChange={(e) => setNumber(e.target.value)} /></label>
          <label>Vence<input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" disabled={busy || !number.trim()}>Confirmar aprobación</button>
            <button type="button" className="secondary" onClick={() => setMode(null)}>Cancelar</button>
          </div>
        </form>
      ) : null}

      {canWrite && (mode === 'observe' || mode === 'reject') ? (
        <form className="auth-card__form" onSubmit={(e) => { e.preventDefault(); update({ status: mode === 'observe' ? 'observed' : 'rejected', notes: appendNote(mode === 'observe' ? 'Observación' : 'Rechazo') }); }}>
          <label>{mode === 'observe' ? 'Qué observó la obra social' : 'Motivo del rechazo'}<input required value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" disabled={busy || !note.trim()}>Guardar</button>
            <button type="button" className="secondary" onClick={() => setMode(null)}>Cancelar</button>
          </div>
        </form>
      ) : null}

      {canWrite && !mode ? (
        <div className="chip-row">
          {['draft', 'observed', 'rejected'].includes(authorization.status) ? (
            <button type="button" className="secondary" disabled={busy} onClick={() => update({ status: 'submitted' })}>
              {authorization.status === 'draft' ? 'Presentar' : 'Volver a presentar'}
            </button>
          ) : null}
          {['submitted', 'observed'].includes(authorization.status) ? (
            <>
              <button type="button" className="secondary" disabled={busy} onClick={() => setMode('approve')}>Aprobada</button>
              {authorization.status === 'submitted' ? <button type="button" className="secondary" disabled={busy} onClick={() => setMode('observe')}>Observada</button> : null}
              <button type="button" className="ghost" disabled={busy} onClick={() => setMode('reject')}>Rechazada</button>
            </>
          ) : null}
          {authorization.status === 'approved' ? (
            <button type="button" className="secondary" disabled={busy} onClick={() => setMode('approve')}>Editar número o vencimiento</button>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="message message--error">{error}</div> : null}
    </article>
  );
}
