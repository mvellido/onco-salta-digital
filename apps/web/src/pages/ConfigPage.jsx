import { ROLE_LABELS, useMe } from '../app/MeContext';
import AdminUsersPanel from '../features/admin/AdminUsersPanel';

export default function ConfigPage() {
  const { me, can } = useMe();

  if (can('users:manage')) {
    return <AdminUsersPanel currentUserId={me.id} />;
  }

  return (
    <section className="section-card">
      <h2>Configuración</h2>
      <p style={{ color: 'var(--muted)', marginTop: 6 }}>
        Tu rol es <strong>{ROLE_LABELS[me.role]}</strong>. Para cambiar permisos o invitar personas, hablá con el administrador del centro.
      </p>
    </section>
  );
}
