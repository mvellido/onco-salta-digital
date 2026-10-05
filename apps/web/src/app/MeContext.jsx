import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../lib/api';

const MeContext = createContext(null);

// Carga el perfil y los permisos del usuario (GET /me) una vez por sesión.
// Mientras carga, o si el usuario no está habilitado, muestra la pantalla correspondiente.
export function MeProvider({ children, onSignOut }) {
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiJson('/me')
      .then((data) => { if (!cancelled) setMe(data); })
      .catch((err) => { if (!cancelled) setError(err.message || 'No se pudo cargar tu perfil.'); });
    return () => { cancelled = true; };
  }, []);

  const can = useCallback((permission) => Boolean(me?.permissions?.includes(permission)), [me]);
  const value = useMemo(() => ({ me, can, onSignOut }), [me, can, onSignOut]);

  if (error) {
    return (
      <div className="auth-page">
        <h1>Sin acceso</h1>
        <p>{error}</p>
        <button type="button" onClick={onSignOut}>Cerrar sesión</button>
      </div>
    );
  }

  if (!me) {
    return <div style={{ padding: 24, color: 'var(--muted)' }}>Cargando permisos…</div>;
  }

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe() {
  return useContext(MeContext);
}

export const ROLE_LABELS = {
  admin: 'Administración',
  doctor: 'Médico/a',
  secretary: 'Secretaría',
  finance: 'Finanzas',
};

// Secciones del menú principal, en orden; cada una con el permiso que la habilita.
export const SECTIONS = [
  { path: '/pacientes', label: 'Pacientes', aria: 'Sección de pacientes', icon: 'users', visible: (can) => can('patients:read') || can('patients:read_basic') },
  { path: '/turnos', label: 'Turnos', aria: 'Sección de secretaría y turnos', icon: 'calendar', visible: (can) => can('appointments:read') },
  { path: '/ia', label: 'IA', aria: 'Sección de asistencia IA', icon: 'sparkles', visible: (can) => can('ai:use') && can('patients:read') },
  { path: '/finanzas', label: 'Finanzas', aria: 'Sección financiera', icon: 'wallet', visible: (can) => can('billing:read') },
  { path: '/config', label: 'Config.', aria: 'Sección de configuración', icon: 'settings', visible: () => true },
];
