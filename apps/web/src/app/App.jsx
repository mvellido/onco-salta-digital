import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import PatientDetail from './PatientDetail';
import { supabase } from './supabaseClient';

const doctorInviteCode = import.meta.env.VITE_DOCTOR_INVITE_CODE || '';

function getAuthErrorMessage(error, isSignUp = false) {
  const message = error?.message || '';

  if (message.includes('Invalid login credentials') || message.includes('invalid login')) {
    return 'Credenciales inválidas. Si acabas de crear la cuenta, confirma tu correo antes de iniciar sesión.';
  }

  if (message.includes('Email not confirmed') || message.includes('email not confirmed')) {
    return 'Tu cuenta aún no está confirmada. Revisa tu correo y confirma la dirección antes de entrar.';
  }

  if (message.includes('User already registered') || message.includes('already registered')) {
    return 'Ese correo ya está registrado. Intenta iniciar sesión en lugar de crear la cuenta.';
  }

  if (message.includes('signup') || message.includes('sign up')) {
    return 'No se pudo crear la cuenta. Verifica que el proveedor Email esté habilitado en Supabase Auth.';
  }

  if (isSignUp) {
    return 'No se pudo crear la cuenta. Revisa la configuración de Supabase Auth y el correo ingresado.';
  }

  return 'No se pudo iniciar sesión. Verifica que Supabase Auth esté habilitado con Email/Password y que las credenciales sean correctas.';
}

function AuthPage({ onSignIn }) {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (isSignUp && doctorInviteCode && invitationCode.trim() !== doctorInviteCode) {
      setError('El código de invitación es incorrecto.');
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: 'doctor' } },
      });

      if (signUpError) {
        setError(getAuthErrorMessage(signUpError, true));
        setLoading(false);
        return;
      }

      if (data.session) {
        onSignIn?.(data.session);
        // Esperar un microtask para que React actualice el estado
        await Promise.resolve();
        navigate('/');
      } else {
        setSuccess('Registro solicitado. Revisa tu correo para confirmar la cuenta.');
      }
    } else {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(getAuthErrorMessage(signInError, false));
        setLoading(false);
        return;
      }

      onSignIn?.(data.session);
      // Esperar un microtask para que React actualice el estado
      await Promise.resolve();
      navigate('/');
    }

    setLoading(false);
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 520, margin: '40px auto', padding: 24 }}>
      <h1>Onco-Salta Digital</h1>
      <p>{isSignUp ? 'Crear cuenta de médico' : 'Iniciar sesión para acceder a la agenda clínica.'}</p>

      {error ? (
        <div style={{ marginBottom: 16, padding: 12, border: '1px solid #f5c2c7', background: '#fff5f5', color: '#842029' }}>
          {error}
        </div>
      ) : null}

      {success ? (
        <div style={{ marginBottom: 16, padding: 12, border: '1px solid #b7e4c7', background: '#f0fff4', color: '#2f6f4e' }}>
          {success}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <label>
          Correo electrónico
          <input aria-label="Correo electrónico" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input aria-label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        {isSignUp ? (
          <label>
            Código de invitación
            <input
              aria-label="Código de invitación"
              type="text"
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value)}
              placeholder={doctorInviteCode ? 'Ingresa el código' : 'Opcional'}
            />
          </label>
        ) : null}

        <button type="submit" disabled={loading}>
          {loading ? (isSignUp ? 'Creando cuenta...' : 'Ingresando...') : isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        <button type="button" onClick={() => { setIsSignUp((current) => !current); setError(''); setSuccess(''); }}>
          {isSignUp ? 'Volver a iniciar sesión' : 'Registrar un médico'}
        </button>
      </p>
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

function Dashboard({ user, onSignOut }) {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    diagnosis_summary: '',
    status: 'active',
    dni: '',
    birth_date: '',
    gender: 'No especificado',
    contact: '',
  });

  const formIsValid = useMemo(() => formData.full_name.trim().length > 0, [formData.full_name]);

  const loadPatients = useCallback(async (showLoading = true, successMessage = '') => {
    if (showLoading) {
      setLoadingPatients(true);
    }

    setMessage((current) => (current.type === 'error' ? { type: '', text: '' } : current));

    const { data, error: fetchError } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setPatients([]);
      setMessage({ type: 'error', text: fetchError.message || 'No se pudieron listar los pacientes.' });
      if (fetchError.status === 401 || fetchError.code === 'PGRST301') {
        supabase.auth.signOut();
      }
    } else {
      setPatients(data || []);
      if (successMessage) {
        setMessage({ type: 'success', text: successMessage });
      }
    }

    setLoadingPatients(false);
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if (event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        setVitalsOpen((current) => !current);
        return;
      }

      if (event.key === 'F5') {
        event.preventDefault();
        loadPatients(true, 'Lista actualizada.');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [loadPatients]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formIsValid) {
      setMessage({ type: 'error', text: 'El nombre del paciente es obligatorio.' });
      return;
    }

    setSavingPatient(true);

    const { data, error: insertError } = await supabase
      .from('patients')
      .insert([
        {
          full_name: formData.full_name,
          diagnosis_summary: formData.diagnosis_summary,
          status: formData.status,
          assigned_doctor_id: user?.id,
          // Nuevas columnas de Supabase
          dni: formData.dni || null,
          birth_date: formData.birth_date || null,
          gender: formData.gender || null,
          contact: formData.contact || null,
          // Campos heredados/compatibilidad
          document_number: formData.dni || null,
          date_of_birth: formData.birth_date || null,
          sex: formData.gender || 'No especificado',
        },
      ])
      .select();

    if (insertError) {
      setMessage({ type: 'error', text: insertError.message || 'No se pudo crear el paciente.' });
      setSavingPatient(false);
      if (insertError.status === 401 || insertError.code === 'PGRST301') {
        supabase.auth.signOut();
      }
      return;
    }

    if (data?.[0]) {
      setPatients((current) => [data[0], ...current]);
      setFormData({
        full_name: '',
        diagnosis_summary: '',
        status: 'active',
        dni: '',
        birth_date: '',
        gender: 'No especificado',
        contact: '',
      });
      setMessage({ type: 'success', text: `Paciente creado correctamente: ${data[0].full_name}` });
    }

    setSavingPatient(false);
  };

  const handleDelete = async (patient) => {
    const confirmed = window.confirm(`¿Confirmás que querés eliminar a ${patient.full_name}?`);
    if (!confirmed) {
      return;
    }

    const { error: deleteError } = await supabase.from('patients').delete().eq('id', patient.id);

    if (deleteError) {
      setMessage({ type: 'error', text: deleteError.message || 'No se pudo eliminar el paciente.' });
      if (deleteError.status === 401 || deleteError.code === 'PGRST301') {
        supabase.auth.signOut();
      }
      return;
    }

    setPatients((current) => current.filter((item) => item.id !== patient.id));
    setMessage({ type: 'success', text: `Paciente eliminado: ${patient.full_name}` });
  };

  const statusLabel = (status) => ({
    active: 'Activo',
    follow_up: 'Seguimiento',
    discharged: 'Alta',
    deceased: 'Fallecido',
  }[status] || status);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 1100, margin: '24px auto', padding: 24, background: '#f8fbff', borderRadius: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Onco-Salta Digital</h1>
          <p style={{ margin: 0, color: '#4b5563' }}>Gestión clínica rápida para pacientes oncológicos.</p>
        </div>
        <button type="button" onClick={onSignOut} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>

      <p style={{ margin: '12px 0 20px', color: '#334155' }}>
        Sesión activa como <strong>{user?.email}</strong>
      </p>

      {message.text ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            border: message.type === 'success' ? '1px solid #86efac' : '1px solid #fda4af',
            background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: message.type === 'success' ? '#166534' : '#b91c1c',
          }}
        >
          {message.text}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 20 }}>
        <section style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 6px 20px rgba(15, 23, 42, 0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h2 style={{ margin: 0 }}>Registrar paciente</h2>
              <p style={{ margin: '4px 0 0', color: '#64748b' }}>Campos obligatorios marcados con <span style={{ color: '#b91c1c' }}>*</span>.</p>
            </div>
            <div style={{ color: '#0f766e', fontSize: 14 }}>Atajos: Enter guarda · F5 recarga · Alt+S signos vitales</div>
          </div>

          <form
            onSubmit={handleSubmit}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA' && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
            style={{ display: 'grid', gap: 12 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
                Nombre completo <span style={{ color: '#b91c1c' }}>*</span>
                <input
                  autoFocus
                  placeholder="Nombre y apellido"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 15 }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
                DNI / Documento
                <input
                  placeholder="Número de documento"
                  value={formData.dni}
                  onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 15 }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
                Fecha de nacimiento
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 15 }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
                Sexo
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 15 }}
                >
                  <option value="No especificado">No especificado</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
                Contacto (Teléfono / Email)
                <input
                  placeholder="Ej. +54 387 1234567 o email"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 15 }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
                Estado clínico
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 15 }}
                >
                  <option value="active">Activo</option>
                  <option value="follow_up">Seguimiento</option>
                  <option value="discharged">Alta</option>
                  <option value="deceased">Fallecido</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Resumen del diagnóstico
              <input
                placeholder="Resumen breve del diagnóstico o patología"
                value={formData.diagnosis_summary}
                onChange={(e) => setFormData({ ...formData, diagnosis_summary: e.target.value })}
                style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 15 }}
              />
            </label>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <button type="submit" disabled={savingPatient || !formIsValid} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: savingPatient ? '#94a3b8' : '#2563eb', color: '#fff', cursor: savingPatient ? 'wait' : 'pointer', fontWeight: 700 }}>
                {savingPatient ? 'Guardando paciente…' : 'Crear paciente'}
              </button>
              {savingPatient ? <span style={{ color: '#0f766e' }}>Guardando…</span> : null}
            </div>
          </form>
        </section>

        <section style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 6px 20px rgba(15, 23, 42, 0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>Pacientes registrados</h2>
              <p style={{ margin: '4px 0 0', color: '#64748b' }}>Lista rápida para consulta y seguimiento.</p>
            </div>
            <button type="button" onClick={() => loadPatients(true, 'Lista actualizada.')} disabled={loadingPatients} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: loadingPatients ? 'wait' : 'pointer' }}>
              {loadingPatients ? 'Recargando…' : 'Recargar lista'}
            </button>
          </div>

          <button type="button" onClick={() => setVitalsOpen((current) => !current)} style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>
            {vitalsOpen ? 'Cerrar' : 'Abrir'} signos vitales
          </button>

          {vitalsOpen ? (
            <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong>Signos vitales</strong>
              <p style={{ margin: '6px 0 0', color: '#475569' }}>Sección rápida para observaciones clínicas del paciente en consulta.</p>
            </div>
          ) : null}

          {loadingPatients && patients.length === 0 ? <p style={{ color: '#0f766e' }}>Cargando pacientes…</p> : null}
          {!loadingPatients && patients.length === 0 ? <p style={{ color: '#64748b' }}>No hay pacientes cargados todavía.</p> : null}

          {patients.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#334155', textAlign: 'left' }}>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>Paciente</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>Diagnóstico</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>Estado</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 700 }}>{patient.full_name}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          {[
                            (patient.dni || patient.document_number) && `DNI: ${patient.dni || patient.document_number}`,
                            (patient.birth_date || patient.date_of_birth) && `Nac.: ${patient.birth_date || patient.date_of_birth}`,
                            (patient.gender || patient.sex) && (patient.gender || patient.sex) !== 'No especificado' && `Sexo: ${patient.gender || patient.sex}`,
                            patient.contact && `Contacto: ${patient.contact}`
                          ].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', color: '#475569' }}>{patient.diagnosis_summary || 'Sin diagnóstico'}</td>
                      <td style={{ padding: '10px 8px' }}>{statusLabel(patient.status)}</td>
                      <td style={{ padding: '10px 8px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => navigate(`/patients/${patient.id}`)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer' }}>
                          Ver historial
                        </button>
                        <button type="button" onClick={() => handleDelete(patient)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', cursor: 'pointer' }}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let authListener = null;

    const initAuth = async () => {
      try {
        // 1. Obtener la sesión inicial de forma secuencial
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error al obtener sesión inicial:', error);
      } finally {
        setAuthReady(true);
      }

      // 2. Registrar el listener solo después de haber resuelto la sesión inicial.
      // Esto evita que getSession y onAuthStateChange realicen peticiones
      // concurrentes de refresco de token, previniendo el error 400.
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setAuthReady(true);
      });
      authListener = data;
    };

    initAuth();

    // Limpiar el listener al desmontar
    return () => {
      if (authListener?.subscription?.unsubscribe) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (!authReady) {
    return <div style={{ padding: 24 }}>Cargando sesión...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute user={user} onSignIn={(session) => setUser(session?.user ?? null)} />} />
        <Route
          path="/"
          element={
            <ProtectedRoute user={user}>
              <Dashboard user={user} onSignOut={handleSignOut} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId"
          element={
            <ProtectedRoute user={user}>
              <PatientDetail user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
