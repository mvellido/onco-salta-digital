export function toValidationDetails(errors = []) {
  return errors.map((err) => ({
    campo: err.instancePath || err.schemaPath || 'payload',
    mensaje: err.message || 'Valor inválido',
    parametro: err.params || {},
  }));
}

export function sendValidationError(reply, message, errors = []) {
  return reply.code(400).send({
    error: message,
    details: toValidationDetails(errors),
  });
}

export function sendError(reply, status, message, details) {
  const payload = { error: message };
  if (details !== undefined) {
    payload.details = details;
  }
  return reply.code(status).send(payload);
}

// Registra el detalle técnico en el log y devuelve al cliente un mensaje genérico
// con el id de la petición, sin exponer mensajes internos de la base.
export function sendServerError(request, reply, err, context) {
  request.log.error({ err }, context);
  return reply.code(500).send({
    error: 'Error interno del servidor. Si se repite, informá este código al administrador.',
    requestId: request.id,
  });
}
