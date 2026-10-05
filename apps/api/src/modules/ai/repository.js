import { scopePatientsQuery } from '../shared/access.js';

export async function getPatientContextForAI(supabase, patientId, ctx) {
  const { data: patient, error: patientError } = await scopePatientsQuery(
    supabase.from('patients').select('*').eq('id', patientId),
    ctx
  ).maybeSingle();

  if (patientError) throw patientError;
  if (!patient) return null;

  const { data: timeline, error: timelineError } = await supabase
    .from('treatment_history')
    .select('id, event_date, event_type, description, outcome_note')
    .eq('patient_id', patientId)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);

  if (timelineError) throw timelineError;

  const [{ data: tumors, error: tumorsError }, { data: treatments, error: treatmentsError }] = await Promise.all([
    supabase.from('tumors').select('*').eq('patient_id', patientId),
    supabase.from('treatments').select('*').eq('patient_id', patientId),
  ]);
  if (tumorsError) throw tumorsError;
  if (treatmentsError) throw treatmentsError;

  return {
    patient: { ...patient, tumors: tumors || [], treatments: treatments || [] },
    timeline: timeline || [],
  };
}

export async function saveInteraction(supabase, row) {
  const { data, error } = await supabase.from('ai_interactions').insert([row]).select().single();
  if (error) throw error;
  return data;
}

export async function listInteractions(supabase, patientId, limit = 30) {
  const { data, error } = await supabase
    .from('ai_interactions')
    .select('id, kind, question, answer, sources, model, provider, redactions, created_at, actor_id')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// Adjunto de la historia clínica, solo si pertenece al paciente indicado.
export async function findAttachmentForPatient(supabase, attachmentId, patientId) {
  const { data: attachment, error } = await supabase
    .from('event_attachments')
    .select('id, event_id, file_name, storage_path, content_type, size')
    .eq('id', attachmentId)
    .maybeSingle();
  if (error) throw error;
  if (!attachment) return null;

  const { data: event, error: eventError } = await supabase
    .from('treatment_history')
    .select('id, patient_id')
    .eq('id', attachment.event_id)
    .maybeSingle();
  if (eventError) throw eventError;

  return event?.patient_id === patientId ? attachment : null;
}

export async function saveExtraction(supabase, row) {
  const { data, error } = await supabase.from('document_extractions').insert([row]).select().single();
  if (error) throw error;
  return data;
}

export async function listExtractions(supabase, patientId) {
  const { data, error } = await supabase
    .from('document_extractions')
    .select('id, attachment_id, method, summary, extracted, redactions, model, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
