export function normalizeBillingRecord(record = {}) {
  return {
    id: record.id || null,
    patient_id: record.patient_id || null,
    invoice_number: record.invoice_number || '',
    amount: Number(record.amount || 0),
    currency: record.currency || 'ARS',
    status: record.status || 'pending',
    issued_at: record.issued_at || null,
    paid_at: record.paid_at || null,
    payer_name: record.payer_name || null,
    notes: record.notes || null,
    payer_id: record.payer_id || null,
    authorization_id: record.authorization_id || null,
    payment_reference: record.payment_reference || null,
  };
}

export function reconcileBillingRecords(records = [], expectedTotal = null) {
  const normalized = records.map(normalizeBillingRecord);
  const matched = normalized.filter((record) => record.status === 'paid');
  const unmatched = normalized.filter((record) => record.status !== 'paid');

  const totalAmount = normalized.reduce((acc, record) => acc + Number(record.amount || 0), 0);
  const delta = expectedTotal === null || expectedTotal === undefined
    ? null
    : Number(totalAmount - Number(expectedTotal));

  return {
    summary: {
      totalRecords: normalized.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      totalAmount,
      expectedTotal,
      delta,
    },
    matched,
    unmatched,
  };
}
