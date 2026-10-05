import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../lib/api';
import { useMe } from '../app/MeContext';
import BillingDashboard from '../features/billing/BillingDashboard';

const EMPTY_BILLING = { patient_id: '', payer_id: '', invoice_number: '', amount: '', status: 'pending', notes: '' };

export default function BillingPage() {
  const { can } = useMe();
  const [patients, setPatients] = useState([]);
  const [payers, setPayers] = useState([]);
  const [billingReport, setBillingReport] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState({ type: '', text: '' });
  const [billingForm, setBillingForm] = useState(EMPTY_BILLING);

  const loadReport = useCallback(async () => {
    setBillingLoading(true);
    try {
      setBillingReport(await apiJson('/billing/reports'));
    } catch (error) {
      setBillingReport(null);
      setBillingMessage({ type: 'error', text: error.message });
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
    apiJson('/patients').then(setPatients).catch(() => setPatients([]));
    apiJson('/payers').then(setPayers).catch(() => setPayers([]));
  }, [loadReport]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setBillingMessage({ type: '', text: '' });
    setBillingLoading(true);
    try {
      const result = await apiJson('/billing/records', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: billingForm.patient_id,
          invoice_number: billingForm.invoice_number.trim(),
          amount: Number(billingForm.amount),
          status: billingForm.status,
          ...(billingForm.payer_id ? { payer_id: billingForm.payer_id } : {}),
          ...(billingForm.notes ? { notes: billingForm.notes } : {}),
        }),
      });
      setBillingMessage({ type: 'success', text: `Factura ${result.invoice_number} registrada.` });
      setBillingForm(EMPTY_BILLING);
      await loadReport();
    } catch (error) {
      setBillingMessage({ type: 'error', text: error.message });
    } finally {
      setBillingLoading(false);
    }
  };

  return (
    <BillingDashboard
      patients={patients}
      payers={payers}
      billingReport={billingReport}
      billingLoading={billingLoading}
      billingMessage={billingMessage}
      billingForm={billingForm}
      setBillingForm={setBillingForm}
      onCreateBillingRecord={handleCreate}
      onReloadReport={loadReport}
      canWrite={can('billing:write')}
    />
  );
}
