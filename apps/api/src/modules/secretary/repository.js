// Dos FK a profiles (professional_id y created_by): el embed se desambigua por nombre.
const APPOINTMENT_COLUMNS = 'id, patient_id, professional_id, date, time, duration_minutes, kind, resource, is_overbook, note, status, created_at, updated_at, patient:patients(full_name), professional:profiles!appointments_professional_id_fkey(full_name, email)';

function applyRange(query, { from, to }) {
  let q = query;
  if (from) q = q.gte('date', from);
  if (to) q = q.lte('date', to);
  return q;
}

// patientIds null = sin filtro (usuarios con scope:all_patients).
// professionalId suma los turnos atendidos por ese profesional aunque el paciente no sea suyo.
export async function listAppointments(supabase, { patientIds = null, professionalId = null, extraProfessionalId = null, from = null, to = null } = {}) {
  const run = async (filter) => {
    let query = applyRange(supabase.from('appointments').select(APPOINTMENT_COLUMNS), { from, to });
    query = filter(query);
    const { data, error } = await query.order('date', { ascending: true }).order('time', { ascending: true });
    if (error) throw error;
    return data || [];
  };

  const byProfessional = (q) => (professionalId ? q.eq('professional_id', professionalId) : q);

  if (patientIds === null) {
    return run(byProfessional);
  }

  const rows = patientIds.length ? await run((q) => byProfessional(q.in('patient_id', patientIds))) : [];
  if (extraProfessionalId && (!professionalId || professionalId === extraProfessionalId)) {
    const own = await run((q) => q.eq('professional_id', extraProfessionalId));
    const seen = new Set(rows.map((row) => row.id));
    rows.push(...own.filter((row) => !seen.has(row.id)));
  }
  return rows.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

// Compatibilidad con llamadas existentes.
export async function listAppointmentsByPatientIds(supabase, patientIds = []) {
  return listAppointments(supabase, { patientIds });
}

// Turnos activos de una fecha que pueden chocar con el candidato (cualquier paciente).
export async function listAppointmentsOnDate(supabase, date) {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_COLUMNS)
    .eq('date', date)
    .neq('status', 'cancelled');
  if (error) throw error;
  return data || [];
}

export async function findAppointmentById(supabase, appointmentId) {
  const { data, error } = await supabase.from('appointments').select(APPOINTMENT_COLUMNS).eq('id', appointmentId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createAppointment(supabase, payload) {
  const { data, error } = await supabase.from('appointments').insert([payload]).select(APPOINTMENT_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function updateAppointmentById(supabase, appointmentId, updates) {
  const { data, error } = await supabase.from('appointments').update(updates).eq('id', appointmentId).select(APPOINTMENT_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function listProfessionals(supabase) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'doctor')
    .eq('active', true)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listSchedules(supabase, professionalId) {
  let query = supabase.from('professional_schedules').select('id, professional_id, weekday, start_time, end_time, slot_minutes, resource');
  if (professionalId) query = query.eq('professional_id', professionalId);
  const { data, error } = await query.order('weekday', { ascending: true }).order('start_time', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({ ...row, start_time: String(row.start_time).slice(0, 5), end_time: String(row.end_time).slice(0, 5) }));
}

export async function replaceSchedules(supabase, professionalId, blocks) {
  const { error: deleteError } = await supabase.from('professional_schedules').delete().eq('professional_id', professionalId);
  if (deleteError) throw deleteError;
  if (!blocks.length) return [];
  const { error } = await supabase.from('professional_schedules').insert(blocks.map((block) => ({ ...block, professional_id: professionalId })));
  if (error) throw error;
  return listSchedules(supabase, professionalId);
}
