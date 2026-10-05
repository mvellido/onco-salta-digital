export function createAuditRecorder(supabase, log) {
  return async function recordAuditEvent({ actorId, patientId = null, resourceType = null, resourceId = null, action, details = {} }) {
    if (!actorId || !action) {
      return;
    }

    try {
      const { error } = await supabase.from('audit_logs').insert([
        {
          actor_id: actorId,
          patient_id: patientId,
          resource_type: resourceType,
          resource_id: resourceId,
          action,
          details,
        },
      ]);

      if (error) {
        log.warn({ err: error, action }, 'No se pudo registrar auditoría');
      }
    } catch (error) {
      log.warn({ err: error, action }, 'Excepción registrando auditoría');
    }
  };
}
