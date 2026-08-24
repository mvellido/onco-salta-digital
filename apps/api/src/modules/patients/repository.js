import { normalizePatientRow } from './models.js';

export async function listPatientsByDoctor(supabase, doctorId) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('assigned_doctor_id', doctorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizePatientRow);
}

export async function createPatientForDoctor(supabase, doctorId, payload) {
  const datosGenerales = payload?.datos_generales || {};
  const historiaTumoral = payload?.historia_tumoral || {};

  const { data, error } = await supabase
    .from('patients')
    .insert([
      {
        full_name: datosGenerales.nombre_completo,
        dni: datosGenerales.dni || null,
        birth_date: datosGenerales.fecha_nacimiento || null,
        gender: datosGenerales.sexo || 'No especificado',
        contact: datosGenerales.contacto || null,
        diagnosis_summary: historiaTumoral.diagnostico_resumen || '',
        tumor_location: historiaTumoral.ubicacion || null,
        tumor_stage: historiaTumoral.estadio || null,
        molecular_markers: historiaTumoral.marcadores_moleculares || {},
        assigned_doctor_id: doctorId,
      },
    ])
    .select();

  if (error) throw error;
  return data?.[0] ? normalizePatientRow(data[0]) : null;
}

export async function getPatientByIdForDoctor(supabase, patientId, doctorId) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .eq('assigned_doctor_id', doctorId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizePatientRow(data) : null;
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

export async function updatePatientByIdForDoctor(supabase, patientId, doctorId, updates) {
  const { data, error } = await supabase
    .from('patients')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', patientId)
    .eq('assigned_doctor_id', doctorId)
    .select();

  if (error) throw error;
  return data?.[0] ? normalizePatientRow(data[0]) : null;
}

export async function deletePatientByIdForDoctor(supabase, patientId, doctorId) {
  const { data, error } = await supabase
    .from('patients')
    .delete()
    .eq('id', patientId)
    .eq('assigned_doctor_id', doctorId)
    .select();

  if (error) throw error;
  return data?.[0] ? normalizePatientRow(data[0]) : null;
}
