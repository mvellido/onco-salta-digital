import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarClock, LogOut, Settings, Sparkles, Users, Wallet } from 'lucide-react';
import Logo from '../components/Logo';
import { ROLE_LABELS, SECTIONS, useMe } from './MeContext';

const ICONS = { users: Users, calendar: CalendarClock, sparkles: Sparkles, wallet: Wallet, settings: Settings };

export function useVisibleSections() {
  const { can } = useMe();
  return SECTIONS.filter((section) => section.visible(can));
}

export default function AppShell() {
  const { me, onSignOut } = useMe();
  const navigate = useNavigate();
  const sections = useVisibleSections();

  // Alt+1…5 cambia de sección (las pestañas de la ficha usan Alt con letras).
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && sections[index]) {
        event.preventDefault();
        navigate(sections[index].path);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sections, navigate]);

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <NavLink to="/" className="app-shell__brand" aria-label="Inicio">
          <Logo />
          <div className="app-shell__brand-title">
            <strong>ONCO-SALTA <em>DIGITAL</em></strong>
            <span>Plataforma clínica oncológica</span>
          </div>
        </NavLink>

        <div className="app-shell__user">
          <div className="app-shell__user-chip">
            <span>{ROLE_LABELS[me.role] || 'Sesión iniciada'}</span>
            <strong>{me.full_name || me.email}</strong>
          </div>
          <button type="button" className="secondary icon-button" onClick={onSignOut}>
            <LogOut size={16} aria-hidden="true" /> Salir
          </button>
        </div>
      </header>

      <nav className="app-shell__nav" aria-label="Secciones">
        {sections.map((section, index) => {
          const Icon = ICONS[section.icon];
          return (
            <NavLink
              key={section.path}
              to={section.path}
              className={({ isActive }) => `main-nav-link${isActive ? ' main-nav-link--active' : ''}`}
              aria-label={section.aria}
              title={`${section.label} (Alt+${index + 1})`}
            >
              <Icon size={22} aria-hidden="true" />
              {section.label}
            </NavLink>
          );
        })}
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
