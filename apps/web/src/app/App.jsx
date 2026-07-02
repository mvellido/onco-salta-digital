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

const getVitalsAlerts = (vitals) => {
  const alerts = {};

  // Presión Arterial
  if (vitals.systolic || vitals.diastolic) {
    const sys = vitals.systolic ? parseInt(vitals.systolic, 10) : null;
    const dia = vitals.diastolic ? parseInt(vitals.diastolic, 10) : null;

    if (sys >= 140 || dia >= 90) {
      alerts.bp = { type: 'danger', message: 'Alerta: Hipertensión' };
    } else if ((sys >= 120 && sys < 140) || (dia >= 80 && dia < 90)) {
      alerts.bp = { type: 'warning', message: 'Atención: Prehipertensión' };
    } else if ((sys !== null && sys < 90) || (dia !== null && dia < 60)) {
      alerts.bp = { type: 'danger', message: 'Alerta: Hipotensión' };
    } else {
      alerts.bp = { type: 'success', message: 'Normal' };
    }
  }

  // Frecuencia Cardíaca
  if (vitals.heartRate) {
    const hr = parseInt(vitals.heartRate, 10);
    if (hr > 100) {
      alerts.hr = { type: 'danger', message: 'Alerta: Taquicardia (>100 lpm)' };
    } else if (hr < 60) {
      alerts.hr = { type: 'danger', message: 'Alerta: Bradicardia (<60 lpm)' };
    } else {
      alerts.hr = { type: 'success', message: 'Normal' };
    }
  }

  // Temperatura
  if (vitals.temperature) {
    const temp = parseFloat(vitals.temperature);
    if (temp >= 38.0) {
      alerts.temp = { type: 'danger', message: 'Alerta: Fiebre (>=38.0°C)' };
    } else if (temp >= 37.3) {
      alerts.temp = { type: 'warning', message: 'Atención: Febrícula (37.3 - 37.9°C)' };
    } else if (temp < 35.0) {
      alerts.temp = { type: 'danger', message: 'Alerta: Hipotermia (<35.0°C)' };
    } else {
      alerts.temp = { type: 'success', message: 'Normal' };
    }
  }

  // Saturación de Oxígeno
  if (vitals.oxygenSaturation) {
    const o2 = parseInt(vitals.oxygenSaturation, 10);
    if (o2 < 90) {
      alerts.o2 = { type: 'danger', message: 'Alerta: Hipoxia Severa (<90%)' };
    } else if (o2 < 95) {
      alerts.o2 = { type: 'warning', message: 'Atención: Hipoxia Leve (90-94%)' };
    } else if (o2 > 100) {
      alerts.o2 = { type: 'danger', message: 'Valor inválido (>100%)' };
    } else {
      alerts.o2 = { type: 'success', message: 'Normal' };
    }
  }

  return alerts;
};

const getAlertStyle = (type) => {
  if (type === 'danger') {
    return {
      background: '#fef2f2',
      color: '#b91c1c',
      border: '1px solid #fecaca',
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '12px',
      display: 'inline-block',
      marginTop: '4px',
      fontWeight: 'bold',
    };
  }
  if (type === 'warning') {
    return {
      background: '#fffbeb',
      color: '#d97706',
      border: '1px solid #fef3c7',
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '12px',
      display: 'inline-block',
      marginTop: '4px',
      fontWeight: 'bold',
    };
  }
  if (type === 'success') {
    return {
      background: '#f0fdf4',
      color: '#166534',
      border: '1px solid #bbf7d0',
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '12px',
      display: 'inline-block',
      marginTop: '4px',
      fontWeight: 'bold',
    };
  }
  return {};
};

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
  const [editingPatient, setEditingPatient] = useState(null);
  const [editingFormData, setEditingFormData] = useState({
    full_name: '',
    diagnosis_summary: '',
    status: 'active',
    dni: '',
    birth_date: '',
    gender: 'No especificado',
    contact: '',
  });
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsMessage, setVitalsMessage] = useState({ type: '', text: '' });
  const [latestVitals, setLatestVitals] = useState([]);
  const [loadingVitalsHistory, setLoadingVitalsHistory] = useState(false);

  const formIsValid = useMemo(() => formData.full_name.trim().length > 0, [formData.full_name]);

  // Alertas visuales dinámicas basadas en los inputs actuales
  const alerts = useMemo(() => getVitalsAlerts(vitalsForm), [vitalsForm]);

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

  // Carga historial de signos vitales para el paciente seleccionado
  const loadLatestVitals = useCallback(async (patientId) => {
    if (!patientId) {
      setLatestVitals([]);
      return;
    }
    setLoadingVitalsHistory(true);

    try {
      let query = supabase.from('vital_signs').select('*');
      const hasEq = typeof query.eq === 'function';
      if (hasEq) {
        query = query.eq('patient_id', patientId);
      }
      let finalQuery = query.order('recorded_at', { ascending: false });
      const hasLimit = typeof finalQuery.limit === 'function';
      if (hasLimit) {
        finalQuery = finalQuery.limit(5);
      }

      const { data, error } = await finalQuery;

      if (error) {
        console.error('Error al cargar historial de signos vitales:', error);
      } else {
        let filteredData = data || [];
        if (!hasEq && data) {
          filteredData = data.filter((item) => item.patient_id === patientId);
        }
        if (!hasLimit && filteredData.length > 5) {
          filteredData = filteredData.slice(0, 5);
        }
        setLatestVitals(filteredData);
      }
    } catch (err) {
      console.error('Error inesperado cargando signos vitales:', err);
    } finally {
      setLoadingVitalsHistory(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  // Carga automática al cambiar de paciente en el formulario
  useEffect(() => {
    loadLatestVitals(vitalsForm.patientId);
  }, [vitalsForm.patientId, loadLatestVitals]);

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
          dni: formData.dni || null,
          birth_date: formData.birth_date || null,
          gender: formData.gender || null,
          contact: formData.contact || null,
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
  const handleEdit = (patient) => {
  setEditingPatient(patient);
  setEditingFormData({
    full_name: patient.full_name || '',
    diagnosis_summary: patient.diagnosis_summary || '',
    status: patient.status || 'active',
    dni: patient.dni || '',
    birth_date: patient.birth_date || '',
    gender: patient.gender || 'No especificado',
    contact: patient.contact || '',
  });
};

  const handleUpdate = async (event) => {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    if (!editingFormData.full_name.trim()) {
      setMessage({ type: 'error', text: 'El nombre del paciente es obligatorio.' });
      return;
    }

    setSavingPatient(true);

    const { error: updateError } = await supabase
      .from('patients')
      .update({
        full_name: editingFormData.full_name,
        diagnosis_summary: editingFormData.diagnosis_summary,
        status: editingFormData.status,
        dni: editingFormData.dni || null,
        birth_date: editingFormData.birth_date || null,
        gender: editingFormData.gender || null,
        contact: editingFormData.contact || null,
        document_number: editingFormData.dni || null,
        date_of_birth: editingFormData.birth_date || null,
        sex: editingFormData.gender || 'No especificado',
      })
      .eq('id', editingPatient.id);

    if (updateError) {
      setMessage({ type: 'error', text: updateError.message || 'No se pudo actualizar el paciente.' });
      setSavingPatient(false);
      if (updateError.status === 401 || updateError.code === 'PGRST301') {
        supabase.auth.signOut();
      }
      return;
    }

    setMessage({ type: 'success', text: `Paciente actualizado: ${editingFormData.full_name}` });
    setEditingPatient(null);
    loadPatients(true, 'Lista actualizada.');
    setSavingPatient(false);
  };
  // Abre el panel y selecciona al paciente haciendo scroll suave al contenedor
  const handleOpenVitals = (patient) => {
    setVitalsForm((prev) => ({
      ...prev,
      patientId: patient.id,
    }));
    setVitalsOpen(true);
    setTimeout(() => {
      const element = document.getElementById('vitals-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  const handleSaveVitals = async (event) => {
    event.preventDefault();
    setVitalsMessage({ type: '', text: '' });

    if (!vitalsForm.patientId) {
      setVitalsMessage({ type: 'error', text: 'El paciente es obligatorio.' });
      return;
    }

    setSavingVitals(true);

    const systolicVal = vitalsForm.systolic ? parseInt(vitalsForm.systolic, 10) : null;
    const diastolicVal = vitalsForm.diastolic ? parseInt(vitalsForm.diastolic, 10) : null;
    const heartRateVal = vitalsForm.heartRate ? parseInt(vitalsForm.heartRate, 10) : null;
    const temperatureVal = vitalsForm.temperature ? parseFloat(vitalsForm.temperature) : null;
    const weightVal = vitalsForm.weight ? parseFloat(vitalsForm.weight) : null;
    const heightVal = vitalsForm.height ? parseFloat(vitalsForm.height) : null;
    const oxygenSaturationVal = vitalsForm.oxygenSaturation ? parseInt(vitalsForm.oxygenSaturation, 10) : null;

    const { error: insertError } = await supabase
      .from('vital_signs')
      .insert([
        {
          patient_id: vitalsForm.patientId,
          blood_pressure_systolic: systolicVal,
          blood_pressure_diastolic: diastolicVal,
          heart_rate: heartRateVal,
          temperature: temperatureVal,
          weight: weightVal,
          height: heightVal,
          oxygen_saturation: oxygenSaturationVal,
        },
      ]);

    if (insertError) {
      setVitalsMessage({ type: 'error', text: insertError.message || 'No se pudieron registrar los signos vitales.' });
      if (insertError.status === 401 || insertError.code === 'PGRST301') {
        supabase.auth.signOut();
      }
    } else {
      setVitalsMessage({ type: 'success', text: 'Signos vitales registrados correctamente.' });
      // Limpia campos del formulario conservando el paciente para ver el historial
      setVitalsForm((prev) => ({
        ...prev,
        systolic: '',
        diastolic: '',
        heartRate: '',
        temperature: '',
        weight: '',
        height: '',
        oxygenSaturation: '',
      }));
      loadLatestVitals(vitalsForm.patientId);
    }

    setSavingVitals(false);
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
            <div id="vitals-section" style={{ marginBottom: 24, padding: 24, borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Registro y Monitoreo de Signos Vitales</h3>
                  <p style={{ margin: '4px 0 0', color: '#475569', fontSize: 14 }}>Registrá y visualizá los signos vitales del paciente seleccionado.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setVitalsOpen(false)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#64748b'
                  }}
                >
                  Ocultar panel
                </button>
              </div>

              {vitalsMessage.text ? (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    marginBottom: 16,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: vitalsMessage.type === 'success' ? '1px solid #86efac' : '1px solid #fda4af',
                    background: vitalsMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    color: vitalsMessage.type === 'success' ? '#166534' : '#b91c1c',
                    fontSize: 14,
                  }}
                >
                  {vitalsMessage.text}
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                {/* Formulario */}
                <form onSubmit={handleSaveVitals} style={{ display: 'grid', gap: 14 }}>
                  <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14 }}>
                    Paciente <span style={{ color: '#b91c1c' }}>*</span>
                    <select
                      value={vitalsForm.patientId}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, patientId: e.target.value })}
                      required
                      style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14, background: '#fff' }}
                    >
                      <option value="">-- Seleccionar paciente --</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} {p.dni ? `(DNI: ${p.dni})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14 }}>
                      Presión Sistólica (mmHg)
                      <input
                        type="number"
                        placeholder="Ej. 120"
                        value={vitalsForm.systolic}
                        onChange={(e) => setVitalsForm({ ...vitalsForm, systolic: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14 }}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14 }}>
                      Presión Diastólica (mmHg)
                      <input
                        type="number"
                        placeholder="Ej. 80"
                        value={vitalsForm.diastolic}
                        onChange={(e) => setVitalsForm({ ...vitalsForm, diastolic: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14 }}
                      />
                    </label>
                  </div>
                  {alerts.bp && (
                    <div style={{ marginTop: -8 }}>
                      <span style={getAlertStyle(alerts.bp.type)}>{alerts.bp.message}</span>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14 }}>
                      Frecuencia Cardíaca (lpm)
                      <input
                        type="number"
                        placeholder="Ej. 75"
                        value={vitalsForm.heartRate}
                        onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14 }}
                      />
                      {alerts.hr && (
                        <div>
                          <span style={getAlertStyle(alerts.hr.type)}>{alerts.hr.message}</span>
                        </div>
                      )}
                    </label>

                    <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14 }}>
                      Temperatura (°C)
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Ej. 36.5"
                        value={vitalsForm.temperature}
                        onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14 }}
                      />
                      {alerts.temp && (
                        <div>
                          <span style={getAlertStyle(alerts.temp.type)}>{alerts.temp.message}</span>
                        </div>
                      )}
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14 }}>
                      Saturación de O₂ (%)
                      <input
                        type="number"
                        placeholder="Ej. 98"
                        value={vitalsForm.oxygenSaturation}
                        onChange={(e) => setVitalsForm({ ...vitalsForm, oxygenSaturation: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14 }}
                      />
                      {alerts.o2 && (
                        <div>
                          <span style={getAlertStyle(alerts.o2.type)}>{alerts.o2.message}</span>
                        </div>
                      )}
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14 }}>
                        Peso (kg)
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Ej. 70"
                          value={vitalsForm.weight}
                          onChange={(e) => setVitalsForm({ ...vitalsForm, weight: e.target.value })}
                          style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14 }}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14 }}>
                        Altura (cm)
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Ej. 175"
                          value={vitalsForm.height}
                          onChange={(e) => setVitalsForm({ ...vitalsForm, height: e.target.value })}
                          style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 14 }}
                        />
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button
                      type="submit"
                      disabled={savingVitals || !vitalsForm.patientId}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        border: 'none',
                        background: savingVitals || !vitalsForm.patientId ? '#94a3b8' : '#0f766e',
                        color: '#fff',
                        cursor: savingVitals || !vitalsForm.patientId ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: 14,
                        flex: 1
                      }}
                    >
                      {savingVitals ? 'Guardando...' : 'Guardar Signos Vitales'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setVitalsForm({
                          patientId: vitalsForm.patientId,
                          systolic: '',
                          diastolic: '',
                          heartRate: '',
                          temperature: '',
                          weight: '',
                          height: '',
                          oxygenSaturation: '',
                        })
                      }
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: 14,
                        color: '#475569'
                      }}
                    >
                      Limpiar
                    </button>
                  </div>
                </form>

                {/* Historial de Signos Vitales */}
                <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 24 }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#334155' }}>Historial del Paciente</h4>
                  {!vitalsForm.patientId ? (
                    <p style={{ color: '#64748b', fontSize: 14, fontStyle: 'italic' }}>
                      Seleccioná un paciente para ver su historial de signos vitales.
                    </p>
                  ) : loadingVitalsHistory ? (
                    <p style={{ color: '#0f766e', fontSize: 14 }}>Cargando historial...</p>
                  ) : latestVitals.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: 14 }}>No hay registros anteriores para este paciente.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: 12, maxHeight: '350px', overflowY: 'auto', paddingRight: 8 }}>
                      {latestVitals.map((item) => {
                        const itemAlerts = getVitalsAlerts({
                          systolic: item.blood_pressure_systolic,
                          diastolic: item.blood_pressure_diastolic,
                          heartRate: item.heart_rate,
                          temperature: item.temperature,
                          oxygenSaturation: item.oxygen_saturation,
                        });
                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: 12,
                              borderRadius: 10,
                              background: '#fff',
                              border: '1px solid #e2e8f0',
                              fontSize: 13,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: 8, fontSize: 12 }}>
                              <strong>Registro</strong>
                              <span>
                                {new Date(item.recorded_at).toLocaleString('es-AR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <strong>P. Arterial:</strong> {item.blood_pressure_systolic && item.blood_pressure_diastolic ? `${item.blood_pressure_systolic}/${item.blood_pressure_diastolic} mmHg` : 'N/A'}
                                {itemAlerts.bp && (
                                  <div style={{ marginTop: 2 }}>
                                    <span style={{ ...getAlertStyle(itemAlerts.bp.type), fontSize: '10px', padding: '1px 4px' }}>{itemAlerts.bp.message}</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <strong>Frec. Cardíaca:</strong> {item.heart_rate ? `${item.heart_rate} lpm` : 'N/A'}
                                {itemAlerts.hr && (
                                  <div style={{ marginTop: 2 }}>
                                    <span style={{ ...getAlertStyle(itemAlerts.hr.type), fontSize: '10px', padding: '1px 4px' }}>{itemAlerts.hr.message}</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <strong>Temperatura:</strong> {item.temperature ? `${parseFloat(item.temperature).toFixed(1)} °C` : 'N/A'}
                                {itemAlerts.temp && (
                                  <div style={{ marginTop: 2 }}>
                                    <span style={{ ...getAlertStyle(itemAlerts.temp.type), fontSize: '10px', padding: '1px 4px' }}>{itemAlerts.temp.message}</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <strong>Saturación O₂:</strong> {item.oxygen_saturation ? `${item.oxygen_saturation}%` : 'N/A'}
                                {itemAlerts.o2 && (
                                  <div style={{ marginTop: 2 }}>
                                    <span style={{ ...getAlertStyle(itemAlerts.o2.type), fontSize: '10px', padding: '1px 4px' }}>{itemAlerts.o2.message}</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <strong>Peso:</strong> {item.weight ? `${parseFloat(item.weight).toFixed(1)} kg` : 'N/A'}
                              </div>
                              <div>
                                <strong>Altura:</strong> {item.height ? `${parseFloat(item.height).toFixed(1)} cm` : 'N/A'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
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
                        <button type="button" onClick={() => handleOpenVitals(patient)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', cursor: 'pointer' }}>
                          Signos Vitales
                        </button>
                        <button type="button" onClick={() => handleDelete(patient)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', cursor: 'pointer' }}>
                          Eliminar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(patient)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: '1px solid #fde68a',
                            background: '#fffbeb',
                            color: '#b45309',
                            cursor: 'pointer'
                          }}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editingPatient && (
              <section style={{ background: '#fff', borderRadius: 16, padding: 20, marginTop: 20, boxShadow: '0 6px 20px rgba(15, 23, 42, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h2 style={{ margin: 0 }}>Editar paciente</h2>
                  <button
                    type="button"
                    onClick={() => setEditingPatient(null)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>

                <form onSubmit={handleUpdate} style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                    <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
                      Nombre completo <span style={{ color: '#b91c1c' }}>*</span>
                      <input
                        value={editingFormData.full_name}
                        onChange={(e) => setEditingFormData({ ...editingFormData, full_name: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 15 }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
                      DNI / Documento
                      <input
                        value={editingFormData.dni}
                        onChange={(e) => setEditingFormData({ ...editingFormData, dni: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 15 }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
                      Fecha de nacimiento
                      <input
                        type="date"
                        value={editingFormData.birth_date}
                        onChange={(e) => setEditingFormData({ ...editingFormData, birth_date: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 15 }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
                      Sexo
                      <select
                        value={editingFormData.gender}
                        onChange={(e) => setEditingFormData({ ...editingFormData, gender: e.target.value })}
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
                        value={editingFormData.contact}
                        onChange={(e) => setEditingFormData({ ...editingFormData, contact: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 15 }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
                      Estado clínico
                      <select
                        value={editingFormData.status}
                        onChange={(e) => setEditingFormData({ ...editingFormData, status: e.target.value })}
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
                      value={editingFormData.diagnosis_summary}
                      onChange={(e) => setEditingFormData({ ...editingFormData, diagnosis_summary: e.target.value })}
                      style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 15 }}
                    />
                  </label>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      type="submit"
                      disabled={savingPatient}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        border: 'none',
                        background: savingPatient ? '#94a3b8' : '#2563eb',
                        color: '#fff',
                        cursor: savingPatient ? 'wait' : 'pointer',
                        fontWeight: 700
                      }}
                    >
                      {savingPatient ? 'Guardando...' : 'Actualizar paciente'}
                    </button>
                  </div>
                </form>
              </section>
            )}
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