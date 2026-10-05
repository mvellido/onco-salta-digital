import { groupRolePermissions } from './service.js';

export async function listUsers(supabase) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, active, created_at')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function listPendingInvitations(supabase) {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, full_name, expires_at, created_at')
    .is('accepted_at', null)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createInvitation(supabase, invitation) {
  const { data, error } = await supabase
    .from('invitations')
    .insert([invitation])
    .select('id, email, role, full_name, expires_at, created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function revokeInvitation(supabase, invitationId) {
  const { data, error } = await supabase
    .from('invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .select('id, email, role')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateProfile(supabase, userId, changes) {
  const { data, error } = await supabase
    .from('profiles')
    .update(changes)
    .eq('id', userId)
    .select('id, email, full_name, role, active, created_at')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getRolePermissionsMap(supabase) {
  const { data, error } = await supabase.from('role_permissions').select('role, permission');

  if (error) throw error;
  return groupRolePermissions(data || []);
}

export async function replaceRolePermissions(supabase, role, permissions) {
  const { error: deleteError } = await supabase.from('role_permissions').delete().eq('role', role);
  if (deleteError) throw deleteError;

  if (permissions.length) {
    const { error: insertError } = await supabase
      .from('role_permissions')
      .insert(permissions.map((permission) => ({ role, permission })));
    if (insertError) throw insertError;
  }
}
