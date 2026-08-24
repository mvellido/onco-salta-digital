import { normalizeBillingRecord } from './models.js';

export async function listBillingRecordsForDoctor(supabase, doctorId) {
  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id')
    .eq('assigned_doctor_id', doctorId);

  if (patientsError) {
    throw patientsError;
  }

  const patientIds = (patients || []).map((patient) => patient.id);
  if (patientIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('billing_records')
    .select('id, patient_id, invoice_number, amount, currency, status, issued_at, paid_at, payer_name, notes, created_at')
    .in('patient_id', patientIds)
    .order('issued_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return (data || []).map(normalizeBillingRecord);
}

export async function createBillingRecord(supabase, payload) {
  const { data, error } = await supabase
    .from('billing_records')
    .insert([payload])
    .select('id, patient_id, invoice_number, amount, currency, status, issued_at, paid_at, payer_name, notes, created_at')
    .single();

  if (error) {
    throw error;
  }

  return normalizeBillingRecord(data);
}
