import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Logo from '../components/Logo';
import { MeProvider } from './MeContext';
import AppShell, { useVisibleSections } from './AppShell';
import PatientsPage from '../pages/PatientsPage';
import PatientRecordPage from '../pages/PatientRecordPage';
import AgendaPage from '../pages/AgendaPage';
import AIPage from '../pages/AIPage';
import FinancePage from '../pages/FinancePage';
import ConfigPage from '../pages/ConfigPage';
import DemoRecordPage from '../pages/DemoRecordPage';
import DemoAgendaPage from '../pages/DemoAgendaPage';
import './styles.css';

function getAuthErrorMessage(error) {
  const message = error?.message || '';

  if (message.includes('Invalid login credentials') || message.includes('invalid login')) {
    return 'Email o contraseña incorrectos.';
  }

  if (message.includes('Email not confirmed') || message.includes('email not confirmed')) {
    return 'Tu cuenta aún no está confirmada. Revisa tu correo y confirma la dirección antes de entrar.';
  }

  return 'No se pudo iniciar sesión. Verifica que Supabase Auth esté habilitado con Email/Password y que las credenciales sean correctas.';
}

function AuthPage({ onSignIn }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(getAuthErrorMessage(signInError));
      setLoading(false);
      return;
    }

    onSignIn?.(data.session);
    await Promise.resolve();
    navigate('/');
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Logo size={48} />
        <h1>ONCO-SALTA <span style={{ color: 'var(--accent)' }}>DIGITAL</span></h1>
      </div>
      <p>Iniciá sesión para acceder a la plataforma clínica.</p>

      {error ? <div className="message message--error" role="alert">{error}</div> : null}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <label>
          Correo electrónico
          <input aria-label="Correo electrónico" autoComplete="username" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input aria-label="Contraseña" autoComplete="current-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Iniciar sesión'}
        </button>
      </form>

      <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>
        El acceso es solo por invitación. Si necesitás una cuenta, pedísela al administrador del centro.
      </p>
    </div>
  );
}

// Destino del link de invitación: Supabase ya abrió la sesión desde la URL;
// acá la persona define su contraseña.
function SetPasswordPage({ user }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 10) {
      setError('La contraseña debe tener al menos 10 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message || 'No se pudo guardar la contraseña.');
      return;
    }

    navigate('/');
  };

  if (!user) {
    return (
      <div className="auth-page">
        <h1>Enlace vencido o inválido</h1>
        <p>Pedile al administrador que te reenvíe la invitación.</p>
        <button type="button" onClick={() => navigate('/login')}>Ir al inicio de sesión</button>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>Bienvenida/o a Onco-Salta Digital</h1>
      <p>Creá tu contraseña para <strong>{user.email}</strong>.</p>

      {error ? <div className="message message--error" role="alert">{error}</div> : null}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <label>
          Nueva contraseña
          <input id="new-password" autoComplete="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
        </label>
        <label>
          Repetir contraseña
          <input id="confirm-password" autoComplete="new-password" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
        </label>
        <button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar y entrar'}</button>
      </form>
    </div>
  );
}

function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function LoginRoute({ user, onSignIn }) {
  if (user) {
    return <Navigate to="/" replace />;
  }

  return <AuthPage onSignIn={onSignIn} />;
}

// La raíz lleva a la primera sección que el rol puede ver.
function HomeRedirect() {
  const sections = useVisibleSections();
  return <Navigate to={sections[0]?.path || '/config'} replace />;
}

function LegacyPatientRedirect() {
  const { patientId } = useParams();
  return <Navigate to={`/pacientes/${patientId}`} replace />;
}

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let authListener = null;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error al obtener sesión inicial:', error);
      } finally {
        setAuthReady(true);
      }

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setAuthReady(true);
      });
      authListener = data;
    };

    initAuth();

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  if (!authReady) {
    return <div style={{ padding: 24 }}>Cargando sesión...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute user={user} onSignIn={(session) => setUser(session?.user ?? null)} />} />
        <Route path="/bienvenida" element={<SetPasswordPage user={user} />} />
        {import.meta.env.DEV ? <Route path="/demo/ficha" element={<main className="main-content" style={{ paddingTop: 24 }}><DemoRecordPage /></main>} /> : null}
        {import.meta.env.DEV ? <Route path="/demo/agenda" element={<main className="main-content" style={{ paddingTop: 24 }}><DemoAgendaPage /></main>} /> : null}
        <Route
          element={
            <ProtectedRoute user={user}>
              <MeProvider key={user?.id} onSignOut={handleSignOut}>
                <AppShell />
              </MeProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<HomeRedirect />} />
          <Route path="pacientes" element={<PatientsPage />} />
          <Route path="pacientes/:patientId" element={<PatientRecordPage />} />
          <Route path="patients/:patientId" element={<LegacyPatientRedirect />} />
          <Route path="turnos" element={<AgendaPage />} />
          <Route path="ia" element={<AIPage />} />
          <Route path="finanzas" element={<FinancePage />} />
          <Route path="config" element={<ConfigPage />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
