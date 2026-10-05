import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../../lib/api';
import { ROLE_LABELS } from '../../app/MeContext';


const PERMISSION_LABELS = {
  'patients:read': 'Ver ficha clínica',
  'patients:read_basic': 'Ver datos básicos del paciente',
  'patients:write': 'Cargar y editar pacientes',
  'patients:archive': 'Archivar pacientes',
  'appointments:read': 'Ver turnos',
  'appointments:write': 'Gestionar turnos',
  'billing:read': 'Ver facturación',
  'billing:write': 'Cargar facturación',
  'ai:use': 'Usar asistente IA',
  'notifications:send': 'Registrar avisos',
  'users:manage': 'Administrar usuarios y permisos',
  'audit:read': 'Ver auditoría',
  'guidelines:manage': 'Administrar biblioteca de guías',
  'scope:all_patients': 'Acceso a todos los pacientes',
};

function Message({ message }) {
  if (!message.text) return null;
  return (
    <div className={`message message--${message.type === 'success' ? 'success' : 'error'}`} role={message.type === 'success' ? 'status' : 'alert'}>
      {message.text}
    </div>
  );
}

export default function AdminUsersPanel({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [matrix, setMatrix] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'doctor' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [usersData, permissionsData] = await Promise.all([apiJson('/admin/users'), apiJson('/admin/permissions')]);
      setUsers(usersData.users);
      setInvitations(usersData.invitations);
      setMatrix(permissionsData);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action, successText) => {
    setBusy(true);
    setMessage({ type: '', text: '' });
    try {
      await action();
      setMessage({ type: 'success', text: successText });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = (event) => {
    event.preventDefault();
    const body = { email: inviteForm.email.trim(), role: inviteForm.role };
    if (inviteForm.full_name.trim()) body.full_name = inviteForm.full_name.trim();
    run(async () => {
      await apiJson('/admin/invitations', { method: 'POST', body: JSON.stringify(body) });
      setInviteForm({ email: '', full_name: '', role: inviteForm.role });
    }, `Invitación enviada a ${body.email}. Ya figura en la lista de usuarios; va a poder entrar cuando cree su contraseña desde el email.`);
  };

  const updateUser = (user, changes, successText) =>
    run(() => apiJson(`/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(changes) }), successText);

  const togglePermission = (role, permission) => {
    const current = matrix.roles[role] || [];
    const next = current.includes(permission) ? current.filter((p) => p !== permission) : [...current, permission];
    run(
      () => apiJson('/admin/permissions', { method: 'PATCH', body: JSON.stringify({ role, permissions: next }) }),
      `Permisos de ${ROLE_LABELS[role]} actualizados.`
    );
  };

  return (
    <div className="page-grid">
      <section className="section-card">
        <h2>Invitar usuario</h2>
        <p style={{ margin: '4px 0 12px', color: 'var(--text-muted)' }}>
          El acceso es solo por invitación. La persona recibe un email para crear su contraseña y entra con el rol que elijas acá.
        </p>
        <Message message={message} />
        <form onSubmit={handleInvite} className="form-grid" style={{ alignItems: 'end' }}>
          <label>
            Email
            <input id="invite-email" type="email" required value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} />
          </label>
          <label>
            Nombre (opcional)
            <input id="invite-name" type="text" value={inviteForm.full_name} onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })} />
          </label>
          <label>
            Rol
            <select id="invite-role" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy || !inviteForm.email.trim()}>Enviar invitación</button>
        </form>

        {invitations.length ? (
          <>
            <h3 style={{ marginTop: 20 }}>Invitaciones pendientes</h3>
            <ul className="admin-list">
              {invitations.map((inv) => (
                <li key={inv.id}>
                  <span><strong>{inv.email}</strong> · {ROLE_LABELS[inv.role]} · vence {new Date(inv.expires_at).toLocaleDateString('es-AR')}</span>
                  <button type="button" className="ghost" disabled={busy} onClick={() => run(() => apiJson(`/admin/invitations/${inv.id}`, { method: 'DELETE' }), `Invitación a ${inv.email} revocada.`)}>
                    Revocar
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section className="section-card">
        <h2>Usuarios</h2>
        <ul className="admin-list">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <li key={user.id}>
                <span>
                  <strong>{user.full_name || user.email}</strong>
                  {user.full_name ? <span style={{ color: 'var(--text-muted)' }}> · {user.email}</span> : null}
                  {!user.active ? <span className="pill pill--muted">Desactivado</span> : null}
                </span>
                <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    aria-label={`Rol de ${user.email}`}
                    value={user.role || ''}
                    disabled={busy || isSelf}
                    onChange={(e) => updateUser(user, { role: e.target.value }, `Rol de ${user.email} actualizado.`)}
                  >
                    {!user.role ? <option value="">Sin rol</option> : null}
                    {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || isSelf || (!user.active && !user.role)}
                    onClick={() => updateUser(user, { active: !user.active }, `${user.email} ${user.active ? 'desactivado' : 'reactivado'}.`)}
                  >
                    {user.active ? 'Desactivar' : 'Reactivar'}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {matrix ? (
        <section className="section-card" style={{ gridColumn: '1 / -1' }}>
          <h2>Permisos por rol</h2>
          <p style={{ margin: '4px 0 12px', color: 'var(--text-muted)' }}>Los cambios se aplican en el próximo pedido de cada usuario.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="perm-table">
              <thead>
                <tr>
                  <th>Permiso</th>
                  {matrix.catalog.roles.map((role) => <th key={role}>{ROLE_LABELS[role]}</th>)}
                </tr>
              </thead>
              <tbody>
                {matrix.catalog.permissions.map((permission) => (
                  <tr key={permission}>
                    <td>{PERMISSION_LABELS[permission] || permission}<br /><code>{permission}</code></td>
                    {matrix.catalog.roles.map((role) => {
                      const locked = role === 'admin' && permission === 'users:manage';
                      return (
                        <td key={role} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            aria-label={`${PERMISSION_LABELS[permission]} para ${ROLE_LABELS[role]}`}
                            checked={(matrix.roles[role] || []).includes(permission)}
                            disabled={busy || locked}
                            onChange={() => togglePermission(role, permission)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
