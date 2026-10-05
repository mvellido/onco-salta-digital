import { normalizeBillingRecord } from './models.js';

// patientIds null = sin filtro (usuarios con scope:all_patients).
export async function listBillingRecords(supabase, patientIds) {
  if (patientIds && patientIds.length === 0) {
    return [];
  }

  let query = supabase
    .from('billing_records')
    .select('id, patient_id, invoice_number, amount, currency, status, issued_at, paid_at, payer_name, notes, created_at');
  if (patientIds) {
    query = query.in('patient_id', patientIds);
  }

  const { data, error } = await query
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
