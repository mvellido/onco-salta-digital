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
