import { sendError, sendServerError, sendValidationError } from '../infra/errors.js';
import { validatePayload } from '../infra/validation.js';
import { PERMISSIONS, ROLES } from '../modules/shared/access.js';
import {
  listUsers,
  listPendingInvitations,
  createInvitation,
  revokeInvitation,
  updateProfile,
  getRolePermissionsMap,
  replaceRolePermissions,
  normalizeInvitationInput,
  normalizePermissionInput,
  validatePermissionUpdate,
  validateUserUpdate,
} from '../modules/admin/index.js';

export default async function adminRoutes(app, { supabase, authenticate, audit, appUrl }) {
  // GET /me - Perfil y permisos del usuario actual (el frontend arma el menú con esto)
  app.get('/me', async (request, reply) => {
    const ctx = await authenticate(request, reply);
    if (!ctx) return;

    return {
      id: ctx.userId,
      email: ctx.email,
      full_name: ctx.fullName,
      role: ctx.role,
      permissions: ctx.permissions,
    };
  });

  // GET /admin/users - Usuarios e invitaciones pendientes
  app.get('/admin/users', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'users:manage');
    if (!ctx) return;

    try {
      const [users, invitations] = await Promise.all([listUsers(supabase), listPendingInvitations(supabase)]);
      return { users, invitations };
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /admin/users');
    }
  });

  // POST /admin/invitations - Alta de usuario solo por invitación (el rol lo fija el servidor)
  app.post('/admin/invitations', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'users:manage');
    if (!ctx) return;

    const validation = validatePayload('adminInvitation', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Invitación inválida: revisá el email y el rol.', validation.errors);
    }

    const input = normalizeInvitationInput(request.body);
    let invitation;

    try {
      invitation = await createInvitation(supabase, { ...input, invited_by: ctx.userId });
    } catch (err) {
      if (err?.code === '23505') {
        return sendError(reply, 409, 'Ya hay una invitación pendiente para ese email.');
      }
      return sendServerError(request, reply, err, 'Exception creating invitation');
    }

    try {
      const { error } = await supabase.auth.admin.inviteUserByEmail(input.email, {
        redirectTo: appUrl ? `${appUrl}/bienvenida` : undefined,
        data: { full_name: input.full_name },
      });

      if (error) {
        await revokeInvitation(supabase, invitation.id);
        if (/already been registered|already registered|exists/i.test(error.message || '')) {
          return sendError(reply, 409, 'Ese email ya tiene cuenta. Si está desactivada, reactivala desde la lista de usuarios.');
        }
        request.log.error({ err: error }, 'Supabase inviteUserByEmail failed');
        return sendError(reply, 502, 'No se pudo enviar el email de invitación. Revisá la configuración de correo de Supabase Auth.');
      }
    } catch (err) {
      await revokeInvitation(supabase, invitation.id).catch(() => {});
      return sendServerError(request, reply, err, 'Exception sending invitation');
    }

    await audit({
      actorId: ctx.userId,
      resourceType: 'invitation',
      resourceId: invitation.id,
      action: 'user_invite',
      details: { email: input.email, role: input.role },
    });

    return reply.code(201).send(invitation);
  });

  // DELETE /admin/invitations/:id - Revocar invitación pendiente
  app.delete('/admin/invitations/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'users:manage');
    if (!ctx) return;

    try {
      const revoked = await revokeInvitation(supabase, request.params.id);
      if (!revoked) {
        return sendError(reply, 404, 'Invitación no encontrada o ya utilizada');
      }

      await audit({
        actorId: ctx.userId,
        resourceType: 'invitation',
        resourceId: revoked.id,
        action: 'user_invite_revoke',
        details: { email: revoked.email, role: revoked.role },
      });

      return { message: 'Invitación revocada', invitation: revoked };
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in DELETE /admin/invitations/:id');
    }
  });

  // PATCH /admin/users/:id - Cambiar rol o activar/desactivar
  app.patch('/admin/users/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'users:manage');
    if (!ctx) return;

    const validation = validatePayload('adminUserUpdate', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Cambio de usuario inválido', validation.errors);
    }

    const { id } = request.params;
    const ruleError = validateUserUpdate(ctx, id, request.body);
    if (ruleError) {
      return sendError(reply, 400, ruleError);
    }

    try {
      const updated = await updateProfile(supabase, id, request.body);
      if (!updated) {
        return sendError(reply, 404, 'Usuario no encontrado');
      }

      await audit({
        actorId: ctx.userId,
        resourceType: 'profile',
        resourceId: id,
        action: 'user_update',
        details: request.body,
      });

      return updated;
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in PATCH /admin/users/:id');
    }
  });

  // GET /admin/permissions - Matriz de permisos por rol
  app.get('/admin/permissions', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'users:manage');
    if (!ctx) return;

    try {
      return { roles: await getRolePermissionsMap(supabase), catalog: { roles: ROLES, permissions: PERMISSIONS } };
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /admin/permissions');
    }
  });

  // PATCH /admin/permissions - Reemplaza los permisos de un rol
  app.patch('/admin/permissions', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'users:manage');
    if (!ctx) return;

    const validation = validatePayload('rolePermissionUpdate', request.body);
    if (!validation.ok) {
      return sendValidationError(reply, 'Payload inválido para permisos', validation.errors);
    }

    const payload = normalizePermissionInput(request.body);
    const ruleError = validatePermissionUpdate(payload);
    if (ruleError) {
      return sendError(reply, 400, ruleError);
    }

    try {
      await replaceRolePermissions(supabase, payload.role, payload.permissions);
      const roles = await getRolePermissionsMap(supabase);

      await audit({
        actorId: ctx.userId,
        resourceType: 'role_permissions',
        action: 'role_permissions_update',
        details: { role: payload.role, permissions: payload.permissions },
      });

      return { role: payload.role, permissions: roles[payload.role], roles };
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in PATCH /admin/permissions');
    }
  });
}
