// Contexto de acceso del usuario autenticado: rol, permisos y alcance de pacientes.
// Los permisos viven en la tabla role_permissions (ver db/supabase/migrations).

export const ROLES = ['admin', 'doctor', 'secretary', 'finance'];

export const PERMISSIONS = [
  'patients:read',
  'patients:read_basic',
  'patients:write',
  'patients:archive',
  'appointments:read',
  'appointments:write',
  'billing:read',
  'billing:write',
  'ai:use',
  'notifications:send',
  'users:manage',
  'audit:read',
  'guidelines:manage',
  'scope:all_patients',
];

export function buildAccessContext(user, profile, permissions = []) {
  const granted = new Set(profile?.active ? permissions : []);

  return {
    userId: user.id,
    email: user.email,
    role: profile?.active ? profile.role : null,
    fullName: profile?.full_name || null,
    active: Boolean(profile?.active),
    permissions: [...granted].sort(),
    can: (permission) => granted.has(permission),
    allPatients: granted.has('scope:all_patients'),
  };
}

export async function loadAccessContext(supabase, user) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile?.active || !profile.role) {
    return buildAccessContext(user, profile, []);
  }

  const { data: rows, error: permissionsError } = await supabase
    .from('role_permissions')
    .select('permission')
    .eq('role', profile.role);

  if (permissionsError) throw permissionsError;

  return buildAccessContext(user, profile, (rows || []).map((row) => row.permission));
}

// Aplica el alcance del usuario a una consulta sobre la tabla patients.
export function scopePatientsQuery(query, ctx) {
  return ctx.allPatients ? query : query.eq('assigned_doctor_id', ctx.userId);
}

export async function canAccessPatient(supabase, patientId, ctx) {
  if (!patientId) return false;

  const { data, error } = await scopePatientsQuery(
    supabase.from('patients').select('id').eq('id', patientId),
    ctx
  ).maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

// null significa "todos los pacientes" (sin filtro).
export async function getAccessiblePatientIds(supabase, ctx) {
  if (ctx.allPatients) return null;

  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('assigned_doctor_id', ctx.userId);

  if (error) throw error;
  return (data || []).map((row) => row.id);
}
