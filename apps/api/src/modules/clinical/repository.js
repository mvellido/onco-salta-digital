export async function listTumors(supabase, patientId) {
  const { data, error } = await supabase
    .from('tumors')
    .select('*')
    .eq('patient_id', patientId)
    .order('is_primary', { ascending: false })
    .order('diagnosis_date', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

export async function listTreatments(supabase, patientId) {
  const { data, error } = await supabase
    .from('treatments')
    .select('*')
    .eq('patient_id', patientId)
    .order('start_date', { ascending: false, nullsFirst: true });

  if (error) throw error;
  return data || [];
}

export async function findClinicalRow(supabase, table, id) {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertClinicalRow(supabase, table, row) {
  const { data, error } = await supabase.from(table).insert([row]).select().single();
  if (error) throw error;
  return data;
}

export async function updateClinicalRow(supabase, table, id, changes) {
  const { data, error } = await supabase.from(table).update(changes).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
