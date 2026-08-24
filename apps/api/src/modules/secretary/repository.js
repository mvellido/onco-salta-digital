export async function listAppointmentsByPatientIds(supabase, patientIds = []) {
  if (!patientIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('id, patient_id, date, time, note, status, created_at, updated_at, patient:patients(full_name)')
    .in('patient_id', patientIds)
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function findAppointmentById(supabase, appointmentId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, patient_id, date, time, note, status, created_at, updated_at, patient:patients(full_name)')
    .eq('id', appointmentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function createAppointment(supabase, payload) {
  const { data, error } = await supabase
    .from('appointments')
    .insert([payload])
    .select('id, patient_id, date, time, note, status, created_at, updated_at, patient:patients(full_name)')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateAppointmentById(supabase, appointmentId, updates) {
  const { data, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', appointmentId)
    .select('id, patient_id, date, time, note, status, created_at, updated_at, patient:patients(full_name)')
    .single();

  if (error) {
    throw error;
  }

  return data;
}
