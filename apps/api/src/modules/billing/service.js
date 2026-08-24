import { reconcileBillingRecords } from './models.js';

export function buildBillingReport(records = []) {
  const totals = records.reduce(
    (acc, record) => {
      const amount = Number(record.amount || 0);
      acc.total += amount;
      acc.byStatus[record.status] = (acc.byStatus[record.status] || 0) + 1;

      if (record.status === 'paid') {
        acc.paidAmount += amount;
      }
      if (record.status === 'pending' || record.status === 'overdue') {
        acc.openAmount += amount;
      }

      return acc;
    },
    {
      total: 0,
      paidAmount: 0,
      openAmount: 0,
      byStatus: { pending: 0, paid: 0, overdue: 0, cancelled: 0 },
    }
  );

  return {
    totals,
    count: records.length,
    records,
  };
}

export function runReconciliation(records = [], expectedTotal = null) {
  return reconcileBillingRecords(records, expectedTotal);
}
