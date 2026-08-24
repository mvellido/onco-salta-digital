export default function BillingDashboard({
  patients,
  billingReport,
  billingLoading,
  billingMessage,
  billingForm,
  setBillingForm,
  onCreateBillingRecord,
  reconForm,
  setReconForm,
  reconResult,
  reconLoading,
  onRunConciliation,
  onReloadReport,
}) {
  const totals = billingReport?.totals || {
    total: 0,
    paidAmount: 0,
    openAmount: 0,
    byStatus: { pending: 0, paid: 0, overdue: 0, cancelled: 0 },
  };

  const reportRecords = billingReport?.records || [];

  return (
    <div className="page-grid">
      <section className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>Finanzas y conciliación</h2>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>Gestioná facturación y revisá el estado de cuenta en tiempo real.</p>
          </div>
          <button type="button" className="secondary" onClick={onReloadReport} disabled={billingLoading}>
            {billingLoading ? 'Actualizando…' : 'Actualizar reporte'}
          </button>
        </div>

        {billingMessage?.text ? (
          <div role={billingMessage.type === 'success' ? 'status' : 'alert'} aria-live={billingMessage.type === 'success' ? 'polite' : 'assertive'} style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, border: billingMessage.type === 'success' ? '1px solid #86efac' : '1px solid #fda4af', background: billingMessage.type === 'success' ? '#f0fdf4' : '#fef2f2', color: billingMessage.type === 'success' ? '#166534' : '#b91c1c' }}>
            {billingMessage.text}
          </div>
        ) : null}

        <div className="turns-overview" style={{ marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          <div className="turns-counter"><span>Total</span><strong>${totals.total.toFixed(2)}</strong></div>
          <div className="turns-counter"><span>Cobrado</span><strong>${totals.paidAmount.toFixed(2)}</strong></div>
          <div className="turns-counter"><span>Pendiente</span><strong>${totals.openAmount.toFixed(2)}</strong></div>
          <div className="turns-counter"><span>Facturas</span><strong>{billingReport?.count || 0}</strong></div>
        </div>

        <form onSubmit={onCreateBillingRecord} className="form-grid" style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 4 }}>Registrar factura</h3>

          <label>
            Paciente
            <select value={billingForm.patient_id} onChange={(e) => setBillingForm({ ...billingForm, patient_id: e.target.value })}>
              <option value="">Selecciona un paciente</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </label>

          <label>
            Número de factura
            <input
              type="text"
              value={billingForm.invoice_number}
              onChange={(e) => setBillingForm({ ...billingForm, invoice_number: e.target.value })}
              placeholder="Ej. FAC-2026-001"
            />
          </label>

          <label>
            Monto
            <input
              type="number"
              step="0.01"
              min="0"
              value={billingForm.amount}
              onChange={(e) => setBillingForm({ ...billingForm, amount: e.target.value })}
              placeholder="0.00"
            />
          </label>

          <label>
            Estado
            <select value={billingForm.status} onChange={(e) => setBillingForm({ ...billingForm, status: e.target.value })}>
              <option value="pending">Pendiente</option>
              <option value="paid">Pagada</option>
              <option value="overdue">Vencida</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>

          <label style={{ gridColumn: 'span 2' }}>
            Observaciones
            <input
              type="text"
              value={billingForm.notes}
              onChange={(e) => setBillingForm({ ...billingForm, notes: e.target.value })}
              placeholder="Observaciones opcionales"
            />
          </label>

          <button type="submit" className="primary" disabled={billingLoading || !billingForm.patient_id || !billingForm.invoice_number.trim() || !billingForm.amount}>
            {billingLoading ? 'Guardando…' : 'Guardar factura'}
          </button>
        </form>
      </section>

      <section className="section-card">
        <h2>Conciliación manual</h2>
        <p style={{ color: 'var(--text-muted)' }}>Pegá un lote JSON y comparalo contra un total esperado para detectar diferencias.</p>

        <form onSubmit={onRunConciliation} style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          <label>
            Total esperado
            <input
              type="number"
              step="0.01"
              value={reconForm.expectedTotal}
              onChange={(e) => setReconForm({ ...reconForm, expectedTotal: e.target.value })}
              placeholder="Ej. 150000"
            />
          </label>

          <label>
            Lote de registros (JSON)
            <textarea
              rows="8"
              value={reconForm.recordsJson}
              onChange={(e) => setReconForm({ ...reconForm, recordsJson: e.target.value })}
              placeholder='[{"invoice_number":"FAC-01","amount":1000,"status":"paid"}]'
            />
          </label>

          <button type="submit" className="secondary" disabled={reconLoading || !reconForm.recordsJson.trim()}>
            {reconLoading ? 'Conciliando…' : 'Ejecutar conciliación'}
          </button>
        </form>

        {reconResult ? (
          <div style={{ marginTop: 16, padding: 14, borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0c4a6e' }}>
            <strong>Resultado</strong>
            <p style={{ margin: '8px 0 0' }}>Registros: {reconResult.summary.totalRecords} · Conciliados: {reconResult.summary.matchedCount} · No conciliados: {reconResult.summary.unmatchedCount}</p>
            <p style={{ margin: '8px 0 0' }}>Total lote: ${reconResult.summary.totalAmount.toFixed(2)} · Delta: {reconResult.summary.delta === null ? 'N/A' : `$${reconResult.summary.delta.toFixed(2)}`}</p>
          </div>
        ) : null}

        <h3 style={{ marginTop: 22 }}>Estado de cuenta reciente</h3>
        {reportRecords.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Todavía no hay facturas registradas.</p>
        ) : (
          <ul className="turns-list">
            {reportRecords.slice(0, 8).map((record) => (
              <li key={record.id || `${record.invoice_number}-${record.issued_at || ''}`} className="turn-card">
                <div className="turn-card__header">
                  <strong>{record.invoice_number}</strong>
                  <span className={`turn-card__pill turn-card__pill--${record.status === 'paid' ? 'completed' : record.status === 'cancelled' ? 'cancelled' : record.status === 'overdue' ? 'cancelled' : 'scheduled'}`}>
                    {record.status}
                  </span>
                </div>
                <div className="turn-card__details">
                  <span>Monto: ${Number(record.amount || 0).toFixed(2)}</span>
                  <span>{record.paid_at ? `Pago: ${record.paid_at}` : 'Sin pago registrado'}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
