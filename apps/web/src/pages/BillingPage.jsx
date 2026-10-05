import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../lib/api';
import BillingDashboard from '../features/billing/BillingDashboard';

const EMPTY_BILLING = { patient_id: '', invoice_number: '', amount: '', status: 'pending', notes: '' };

export default function BillingPage() {
  const [patients, setPatients] = useState([]);
  const [billingReport, setBillingReport] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState({ type: '', text: '' });
  const [billingForm, setBillingForm] = useState(EMPTY_BILLING);
  const [reconForm, setReconForm] = useState({ expectedTotal: '', recordsJson: '' });
  const [reconResult, setReconResult] = useState(null);
  const [reconLoading, setReconLoading] = useState(false);

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
  }, [loadReport]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setBillingMessage({ type: '', text: '' });
    if (!billingForm.patient_id || !billingForm.invoice_number.trim() || !billingForm.amount) {
      setBillingMessage({ type: 'error', text: 'Paciente, número de factura y monto son obligatorios.' });
      return;
    }

    setBillingLoading(true);
    try {
      const result = await apiJson('/billing/records', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: billingForm.patient_id,
          invoice_number: billingForm.invoice_number.trim(),
          amount: Number(billingForm.amount),
          status: billingForm.status,
          ...(billingForm.notes ? { notes: billingForm.notes } : {}),
        }),
      });
      setBillingMessage({ type: 'success', text: `Factura registrada: ${result.invoice_number}` });
      setBillingForm(EMPTY_BILLING);
      await loadReport();
    } catch (error) {
      setBillingMessage({ type: 'error', text: error.message });
    } finally {
      setBillingLoading(false);
    }
  };

  const handleConciliation = async (event) => {
    event.preventDefault();
    setBillingMessage({ type: '', text: '' });
    setReconResult(null);

    let records;
    try {
      records = JSON.parse(reconForm.recordsJson);
    } catch {
      setBillingMessage({ type: 'error', text: 'El lote de conciliación no es un JSON válido.' });
      return;
    }
    if (!Array.isArray(records) || records.length === 0) {
      setBillingMessage({ type: 'error', text: 'Enviá una lista de registros para conciliar.' });
      return;
    }

    setReconLoading(true);
    try {
      setReconResult(await apiJson('/billing/conciliate', {
        method: 'POST',
        body: JSON.stringify({ records, expectedTotal: reconForm.expectedTotal ? Number(reconForm.expectedTotal) : null }),
      }));
      setBillingMessage({ type: 'success', text: 'Conciliación ejecutada.' });
    } catch (error) {
      setBillingMessage({ type: 'error', text: error.message });
    } finally {
      setReconLoading(false);
    }
  };

  return (
    <BillingDashboard
      patients={patients}
      billingReport={billingReport}
      billingLoading={billingLoading}
      billingMessage={billingMessage}
      billingForm={billingForm}
      setBillingForm={setBillingForm}
      onCreateBillingRecord={handleCreate}
      reconForm={reconForm}
      setReconForm={setReconForm}
      reconResult={reconResult}
      reconLoading={reconLoading}
      onRunConciliation={handleConciliation}
      onReloadReport={loadReport}
    />
  );
}
