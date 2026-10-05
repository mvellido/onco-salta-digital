import { scopePatientsQuery } from '../shared/access.js';
import { normalizePatientRow } from './models.js';

export async function listPatients(supabase, ctx, { archived = false } = {}) {
  let query = scopePatientsQuery(supabase.from('patients').select('*'), ctx);
  query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizePatientRow);
}

export async function createPatient(supabase, row) {
  const { data, error } = await supabase
    .from('patients')
    .insert([row])
    .select()
    .single();

  if (error) throw error;
  return normalizePatientRow(data);
}

export async function getPatientById(supabase, patientId, ctx) {
  const { data, error } = await scopePatientsQuery(
    supabase.from('patients').select('*').eq('id', patientId),
    ctx
  ).maybeSingle();

  if (error) throw error;
  return data ? normalizePatientRow(data) : null;
}

export async function isActiveDoctor(supabase, profileId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('role', 'doctor')
    .eq('active', true)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function getPatientTimeline(supabase, patientId) {
  const { data, error } = await supabase
    .from('treatment_history')
    .select('id, event_date, event_type, description, outcome_note, created_by, created_at')
    .eq('patient_id', patientId)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getEventAttachmentCounts(supabase, eventIds) {
  if (!eventIds?.length) return {};

  const { data, error } = await supabase
    .from('event_attachments')
    .select('event_id')
    .in('event_id', eventIds);

  if (error) throw error;

  return (data || []).reduce((acc, row) => {
    acc[row.event_id] = (acc[row.event_id] || 0) + 1;
    return acc;
  }, {});
}

export async function updatePatientById(supabase, patientId, ctx, updates) {
  const { data, error } = await scopePatientsQuery(
    supabase.from('patients').update(updates).eq('id', patientId),
    ctx
  ).select();

  if (error) throw error;
  return data?.[0] ? normalizePatientRow(data[0]) : null;
}
