import { ROLE_LABELS, useMe } from '../app/MeContext';
import AdminUsersPanel from '../features/admin/AdminUsersPanel';
import GuidelinesPanel from '../features/admin/GuidelinesPanel';

export default function ConfigPage() {
  const { me, can } = useMe();
  const manageUsers = can('users:manage');
  const manageGuidelines = can('guidelines:manage');

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {manageGuidelines ? <GuidelinesPanel /> : null}
      {manageUsers ? <AdminUsersPanel currentUserId={me.id} /> : null}
      {!manageUsers && !manageGuidelines ? (
        <section className="section-card">
          <h2>Configuración</h2>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>
            Tu rol es <strong>{ROLE_LABELS[me.role]}</strong>. Para cambiar permisos, invitar personas o cargar guías, hablá con el administrador del centro.
          </p>
        </section>
      ) : null}
    </div>
  );
}
