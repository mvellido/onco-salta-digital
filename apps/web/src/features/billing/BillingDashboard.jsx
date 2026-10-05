import { formatDate } from '../record/catalog';

export const money = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(Number(value || 0));

export const BILLING_STATUS = {
  pending: { label: 'Pendiente', pill: 'scheduled' },
  paid: { label: 'Cobrada', pill: 'completed' },
  overdue: { label: 'Vencida', pill: 'cancelled' },
  cancelled: { label: 'Anulada', pill: 'cancelled' },
};

export default function BillingDashboard({
  patients,
  payers = [],
  billingReport,
  billingLoading,
  billingMessage,
  billingForm,
  setBillingForm,
  onCreateBillingRecord,
  onReloadReport,
  canWrite,
}) {
  const totals = billingReport?.totals || { total: 0, paidAmount: 0, openAmount: 0 };
  const records = billingReport?.records || [];
  const payerName = Object.fromEntries(payers.map((p) => [p.id, p.name]));
  const set = (field) => (event) => setBillingForm({ ...billingForm, [field]: event.target.value });

  return (
    <div className={canWrite ? 'split-layout' : 'page-grid'}>
      <section className="section-card" style={{ display: 'grid', gap: 14 }}>
        <div className="toolbar">
          <div>
            <h2>Facturación</h2>
            <p style={{ color: 'var(--muted)' }}>Estado de cuenta de los pacientes a tu alcance.</p>
          </div>
          <button type="button" className="secondary" onClick={onReloadReport} disabled={billingLoading}>
            {billingLoading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {billingMessage?.text ? (
          <div className={`message message--${billingMessage.type === 'success' ? 'success' : 'error'}`} role={billingMessage.type === 'success' ? 'status' : 'alert'}>
            {billingMessage.text}
          </div>
        ) : null}

        <div className="turns-overview" style={{ marginTop: 0 }}>
          <div className="turns-counter"><span>Facturado</span><strong>{money(totals.total)}</strong></div>
          <div className="turns-counter"><span>Cobrado</span><strong>{money(totals.paidAmount)}</strong></div>
          <div className="turns-counter"><span>Por cobrar</span><strong>{money(totals.openAmount)}</strong></div>
          <div className="turns-counter"><span>Facturas</span><strong>{billingReport?.count || 0}</strong></div>
        </div>

        {records.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Factura</th><th>Emitida</th><th>Financiador</th><th style={{ textAlign: 'right' }}>Importe</th><th>Estado</th></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="mono"><strong>{r.invoice_number}</strong></td>
                    <td className="mono">{formatDate(r.issued_at)}</td>
                    <td>{payerName[r.payer_id] || r.payer_name || 'Particular'}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{money(r.amount)}</td>
                    <td>
                      <span className={`turn-card__pill turn-card__pill--${BILLING_STATUS[r.status]?.pill}`}>{BILLING_STATUS[r.status]?.label || r.status}</span>
                      {r.paid_at ? <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--muted)' }} title={r.payment_reference || ''}>{formatDate(r.paid_at)}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-state">Todavía no hay facturas registradas.</div>}
      </section>

      {canWrite ? (
        <section className="section-card">
          <span className="eyebrow">Nueva factura</span>
          <form onSubmit={onCreateBillingRecord} style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            <label>
              Paciente
              <select id="bill-patient" value={billingForm.patient_id} onChange={set('patient_id')}>
                <option value="">Elegí un paciente</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </label>
            <label>
              Financiador
              <select id="bill-payer" value={billingForm.payer_id || ''} onChange={set('payer_id')}>
                <option value="">Particular</option>
                {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              <label>Número<input id="bill-number" value={billingForm.invoice_number} onChange={set('invoice_number')} placeholder="A-0001-00000123" /></label>
              <label>Importe<input id="bill-amount" type="number" step="0.01" min="0" value={billingForm.amount} onChange={set('amount')} /></label>
            </div>
            <label>
              Estado
              <select id="bill-status" value={billingForm.status} onChange={set('status')}>
                {Object.entries(BILLING_STATUS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </select>
            </label>
            <label>Observaciones<input id="bill-notes" value={billingForm.notes} onChange={set('notes')} /></label>
            <button type="submit" disabled={billingLoading || !billingForm.patient_id || !billingForm.invoice_number.trim() || !billingForm.amount}>
              {billingLoading ? 'Guardando…' : 'Guardar factura'}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
