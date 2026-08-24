export async function getPatientContextForAI(supabase, patientId, doctorId) {
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .eq('assigned_doctor_id', doctorId)
    .maybeSingle();

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

  return {
    patient,
    timeline: timeline || [],
  };
}

export async function listRecentDocumentsForPatient(supabase, patientId) {
  const { data, error } = await supabase
    .from('event_attachments')
    .select('id, event_id, file_name, content_type, created_at')
    .in(
      'event_id',
      (
        await supabase
          .from('treatment_history')
          .select('id')
          .eq('patient_id', patientId)
          .order('event_date', { ascending: false })
          .limit(20)
      ).data?.map((row) => row.id) || ['00000000-0000-0000-0000-000000000000']
    )
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
}
