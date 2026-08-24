const secretaryRolePermissions = {
  secretary: ['appointments:read', 'appointments:write', 'notifications:send'],
  doctor: ['appointments:read', 'appointments:write', 'patients:read', 'patients:write'],
  finance: ['billing:read', 'billing:write'],
  admin: ['*'],
};

export function hasScheduleConflict(appointments = [], candidate = {}, currentAppointmentId = null) {
  return appointments.some((appointment) => {
    if (currentAppointmentId && appointment.id === currentAppointmentId) {
      return false;
    }

    if (appointment.status === 'cancelled') {
      return false;
    }

    return appointment.patient_id === candidate.patient_id
      && appointment.date === candidate.date
      && appointment.time === candidate.time;
  });
}

export function buildNotificationDispatch({ channel = 'in-app', recipients = [], message = '' }) {
  return {
    channel,
    recipients,
    message,
    status: recipients.length ? 'queued' : 'skipped',
    dispatchedAt: new Date().toISOString(),
  };
}

export function getRolePermissionsMap() {
  return secretaryRolePermissions;
}

export function updateRolePermissions(currentMap, role, permissions) {
  return {
    ...currentMap,
    [role]: permissions,
  };
}
