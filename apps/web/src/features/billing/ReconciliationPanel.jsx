import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileUp } from 'lucide-react';
import { apiJson } from '../../lib/api';
import { formatDate } from '../record/catalog';
import { money } from './BillingDashboard';

const LINE_STATUS = {
  proposed: { label: 'Propuesta', chip: '' },
  review: { label: 'A revisar', chip: 'chip--warn' },
  unmatched: { label: 'Sin pareja', chip: 'chip--muted' },
  matched: { label: 'Conciliada', chip: 'chip--teal' },
  ignored: { label: 'Ignorada', chip: 'chip--muted' },
};

// Los bancos suelen exportar en Windows-1252: si no es UTF-8 válido, se decodifica así.
export async function readCsvFile(file) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function StatementLines({ statement, patients, canWrite, onConfirmed, onIgnored }) {
  const patientName = useMemo(() => Object.fromEntries(patients.map((p) => [p.id, p.full_name])), [patients]);
  const [choices, setChoices] = useState(() => Object.fromEntries(
    statement.lines.filter((l) => l.status === 'proposed').map((l) => [l.id, l.candidates[0]?.record_id])
  ));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const counts = statement.lines.reduce((acc, l) => ({ ...acc, [l.status]: (acc[l.status] || 0) + 1 }), {});
  const selected = Object.entries(choices).filter(([, recordId]) => recordId);

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await apiJson(`/billing/statements/${statement.import.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ matches: selected.map(([lineId, recordId]) => ({ line_id: lineId, record_id: recordId })) }),
      });
      setChoices({});
      onConfirmed(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const ignore = async (line) => {
    try {
      const saved = await apiJson(`/billing/statements/${statement.import.id}/lines/${line.id}/ignore`, { method: 'POST' });
      setChoices(({ [line.id]: _, ...rest }) => rest);
      onIgnored(saved);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="toolbar">
        <div>
          <span className="eyebrow">{formatDate(statement.import.created_at)} · {statement.import.file_name || 'extracto'}</span>
          <h2>{statement.import.source_name}</h2>
        </div>
        <div className="chip-row">
          {Object.entries(LINE_STATUS).map(([status, meta]) => counts[status] ? <span key={status} className={`chip ${meta.chip}`}>{meta.label}: {counts[status]}</span> : null)}
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table recon-table">
          <thead>
            <tr><th>Fecha</th><th>Movimiento</th><th style={{ textAlign: 'right' }}>Importe</th><th>Estado</th><th>Factura</th><th><span className="visually-hidden">Acciones</span></th></tr>
          </thead>
          <tbody>
            {statement.lines.map((line) => {
              const meta = LINE_STATUS[line.status];
              const open = ['proposed', 'review'].includes(line.status) && canWrite;
              const chosen = line.candidates.find((c) => c.record_id === choices[line.id]);
              return (
                <tr key={line.id} className={`recon-row recon-row--${line.status}`}>
                  <td className="mono">{formatDate(line.date)}</td>
                  <td style={{ maxWidth: 320 }}>
                    <div style={{ overflowWrap: 'anywhere' }}>{line.description || '—'}</div>
                    {line.reference ? <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Ref. {line.reference}</div> : null}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', color: line.amount < 0 ? 'var(--danger)' : undefined }}>{money(line.amount)}</td>
                  <td><span className={`chip ${meta.chip}`}>{meta.label}</span></td>
                  <td style={{ minWidth: 220 }}>
                    {open ? (
                      <>
                        <select aria-label={`Factura para la fila ${line.line_no}`} value={choices[line.id] || ''} onChange={(e) => setChoices({ ...choices, [line.id]: e.target.value })}>
                          <option value="">No conciliar</option>
                          {line.candidates.map((c) => (
                            <option key={c.record_id} value={c.record_id}>{c.invoice_number} · {patientName[c.patient_id] || 'paciente'}</option>
                          ))}
                        </select>
                        {chosen ? <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 3 }}>{chosen.reasons.join(' · ')}</div> : null}
                      </>
                    ) : line.status === 'matched' ? (
                      <span className="mono">{line.candidates.find((c) => c.record_id === line.matched_record_id)?.invoice_number || 'Conciliada'}</span>
                    ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td>
                    {canWrite && !['matched', 'ignored'].includes(line.status) && line.amount > 0 ? (
                      <button type="button" className="ghost" onClick={() => ignore(line)} title="No corresponde a una factura">Ignorar</button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error ? <div className="message message--error" role="alert">{error}</div> : null}
      {canWrite ? (
        <div className="toolbar recon-confirm">
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
            Al confirmar, cada factura elegida queda cobrada con la fecha del movimiento. Nada se marca sin tu confirmación.
          </p>
          <button type="button" disabled={busy || !selected.length} onClick={confirm}>
            {busy ? 'Confirmando…' : `Confirmar ${selected.length} ${selected.length === 1 ? 'emparejamiento' : 'emparejamientos'}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function ReconciliationPanel({ canWrite }) {
  const [imports, setImports] = useState([]);
  const [statement, setStatement] = useState(null);
  const [patients, setPatients] = useState([]);
  const [payers, setPayers] = useState([]);
  const [form, setForm] = useState({ source_name: '', payer_id: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadImports = useCallback(() => apiJson('/billing/statements').then(setImports).catch((err) => setMessage({ type: 'error', text: err.message })), []);

  useEffect(() => {
    loadImports();
    apiJson('/patients').then(setPatients).catch(() => {});
    apiJson('/payers').then(setPayers).catch(() => {});
  }, [loadImports]);

  const open = async (id) => {
    try {
      setStatement(await apiJson(`/billing/statements/${id}`));
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const upload = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage({ type: '', text: '' });
    try {
      const csvText = await readCsvFile(file);
      const result = await apiJson('/billing/statements', {
        method: 'POST',
        body: JSON.stringify({ source_name: form.source_name.trim(), payer_id: form.payer_id || null, file_name: file.name, csv_text: csvText }),
      });
      setStatement(result);
      setFile(null);
      event.target.reset();
      const proposed = result.lines.filter((l) => l.status === 'proposed').length;
      setMessage({ type: 'success', text: `${result.lines.length} movimientos leídos; ${proposed} con factura propuesta. Revisalos y confirmá.` });
      loadImports();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      if (err.status === 409) loadImports();
    } finally {
      setBusy(false);
    }
  };

  const replaceLines = (updated) => setStatement((current) => ({
    ...current,
    lines: current.lines.map((l) => updated.find((u) => u.id === l.id) || l),
  }));

  return (
    <div className="split-layout split-layout--reverse">
      <section className="section-card" style={{ minWidth: 0 }}>
        {statement ? (
          <StatementLines
            key={statement.import.id}
            statement={statement}
            patients={patients}
            canWrite={canWrite}
            onConfirmed={(result) => { replaceLines(result.lines); setMessage({ type: 'success', text: `${result.confirmed} facturas quedaron cobradas.` }); }}
            onIgnored={(line) => replaceLines([line])}
          />
        ) : (
          <div className="empty-state">
            Importá un extracto bancario o la liquidación de una obra social en CSV. El sistema propone qué factura corresponde a cada crédito y vos confirmás.
          </div>
        )}
      </section>

      <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        {canWrite ? (
          <section className="section-card">
            <span className="eyebrow">Importar extracto</span>
            <form onSubmit={upload} style={{ display: 'grid', gap: 10, marginTop: 8 }}>
              <label>Origen<input id="recon-source" required minLength={2} value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })} placeholder="Ej.: Banco - cuenta corriente" /></label>
              <label>
                Obra social (si es una liquidación)
                <select id="recon-payer" value={form.payer_id} onChange={(e) => setForm({ ...form, payer_id: e.target.value })}>
                  <option value="">—</option>
                  {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label>Archivo CSV<input id="recon-file" type="file" accept=".csv,text/csv" required onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Necesita columnas de fecha e importe (o débito y crédito). Acepta 1.234,56 y fechas dd/mm/aaaa.</p>
              <button type="submit" className="icon-button" disabled={busy || !file || form.source_name.trim().length < 2}>
                <FileUp size={16} aria-hidden="true" /> {busy ? 'Leyendo…' : 'Importar y emparejar'}
              </button>
            </form>
          </section>
        ) : null}

        {message.text ? <div className={`message message--${message.type === 'success' ? 'success' : 'error'}`}>{message.text}</div> : null}

        <section className="section-card">
          <span className="eyebrow">Extractos importados</span>
          {imports.length ? (
            <ul className="admin-list" style={{ marginTop: 8 }}>
              {imports.map((imp) => (
                <li key={imp.id} style={statement?.import.id === imp.id ? { borderColor: 'var(--accent)' } : undefined}>
                  <button type="button" className="secondary" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', display: 'grid' }} onClick={() => open(imp.id)}>
                    <strong>{imp.source_name}</strong>
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{formatDate(imp.created_at)} · {imp.line_count} mov. · {money(imp.credit_total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p style={{ color: 'var(--muted)', marginTop: 8 }}>Todavía no hay extractos.</p>}
        </section>
      </aside>
    </div>
  );
}
