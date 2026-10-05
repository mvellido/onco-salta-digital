import { PERMISSIONS, ROLES } from '../shared/access.js';

export function normalizePermissionInput(payload = {}) {
  return {
    role: String(payload.role || '').trim(),
    permissions: Array.isArray(payload.permissions)
      ? [...new Set(payload.permissions.map((item) => String(item).trim()).filter(Boolean))]
      : [],
  };
}

export function validatePermissionUpdate({ role, permissions }) {
  if (!ROLES.includes(role)) {
    return `Rol desconocido: ${role}`;
  }

  const unknown = permissions.filter((permission) => !PERMISSIONS.includes(permission));
  if (unknown.length) {
    return `Permisos desconocidos: ${unknown.join(', ')}`;
  }

  if (role === 'admin' && !permissions.includes('users:manage')) {
    return 'El rol admin debe conservar users:manage; si no, nadie podría volver a administrar usuarios.';
  }

  return null;
}

export function validateUserUpdate(ctx, targetUserId, changes) {
  if (changes.role !== undefined && !ROLES.includes(changes.role)) {
    return `Rol desconocido: ${changes.role}`;
  }

  if (targetUserId === ctx.userId && (changes.active === false || (changes.role !== undefined && changes.role !== ctx.role))) {
    return 'No podés desactivarte ni cambiar tu propio rol. Pedíselo a otro administrador.';
  }

  return null;
}

export function normalizeInvitationInput(payload = {}) {
  return {
    email: String(payload.email || '').trim().toLowerCase(),
    role: String(payload.role || '').trim(),
    full_name: payload.full_name ? String(payload.full_name).trim() : null,
  };
}

export function groupRolePermissions(rows = []) {
  const map = Object.fromEntries(ROLES.map((role) => [role, []]));
  for (const row of rows) {
    if (map[row.role]) {
      map[row.role].push(row.permission);
    }
  }
  for (const role of ROLES) {
    map[role].sort();
  }
  return map;
}
