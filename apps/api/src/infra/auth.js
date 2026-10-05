import { loadAccessContext } from '../modules/shared/access.js';
import { sendError, sendServerError } from './errors.js';

function extractBearerToken(request) {
  const authHeader = request.headers?.authorization || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return authHeader.slice(7).trim();
}

// Devuelve el contexto de acceso, o null si ya respondió con 401/403.
// Con `permission`, exige además ese permiso (o cualquiera de una lista).
export function createAuthGuard(supabase) {
  return async function authenticate(request, reply, permission = null) {
    const token = extractBearerToken(request);
    if (!token) {
      sendError(reply, 401, 'No autenticado: falta token Bearer');
      return null;
    }

    let ctx;
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        sendError(reply, 401, 'No autenticado: token inválido o expirado');
        return null;
      }

      ctx = await loadAccessContext(supabase, data.user);
    } catch (err) {
      sendServerError(request, reply, err, 'Error verificando la sesión');
      return null;
    }

    if (!ctx.active) {
      sendError(reply, 403, 'Tu usuario no está habilitado. Pedí una invitación al administrador.');
      return null;
    }

    const required = Array.isArray(permission) ? permission : permission ? [permission] : [];
    if (required.length && !required.some((perm) => ctx.can(perm))) {
      sendError(reply, 403, 'Tu rol no tiene permiso para esta acción.');
      return null;
    }

    return ctx;
  };
}
