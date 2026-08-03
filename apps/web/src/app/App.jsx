import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, Link } from 'react-router-dom';
import PatientDetail from './PatientDetail';
import { supabase } from './supabaseClient';
import { API_URL } from '../config';
import './styles.css';

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
  const [vitalsForm, setVitalsForm] = useState({
    patientId: '',
    systolic: '',
    diastolic: '',
    heartRate: '',
    temperature: '',
    weight: '',
    height: '',
    oxygenSaturation: '',
  });  
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsMessage, setVitalsMessage] = useState({ type: '', text: '' });
  const [latestVitals, setLatestVitals] = useState([]);
  const [loadingVitalsHistory, setLoadingVitalsHistory] = useState(false);
  const [turns, setTurns] = useState([]);
  const [turnForm, setTurnForm] = useState({ patientId: '', date: '', time: '', note: '' });
  const [turnSaving, setTurnSaving] = useState(false);
  const [turnsMessage, setTurnsMessage] = useState({ type: '', text: '' });
  const [iaPatientId, setIaPatientId] = useState('');
  const [iaQuestion, setIaQuestion] = useState('');
  const [iaAnswer, setIaAnswer] = useState('');
  const [iaLoading, setIaLoading] = useState(false);
  const [iaError, setIaError] = useState('');
  const [activeSection, setActiveSection] = useState('pacientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const formIsValid = useMemo(() => formData.full_name.trim().length > 0, [formData.full_name]);
  // Pacientes filtrados por búsqueda y estado
  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      // Filtro por búsqueda (nombre o DNI)
      const matchesSearch = patient.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (patient.dni && patient.dni.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Filtro por estado clínico
      const matchesStatus = statusFilter === 'todos' || patient.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [patients, searchTerm, statusFilter]);

  // Alertas visuales dinámicas basadas en los inputs actuales
  const alerts = useMemo(() => getVitalsAlerts(vitalsForm), [vitalsForm]);

  const loadPatients = useCallback(async (showLoading = true, successMessage = '') => {
    if (showLoading) {
      setLoadingPatients(true);
    }

    setMessage((current) => (current.type === 'error' ? { type: '', text: '' } : current));

    try {
      const response = await fetch(`${API_URL}/patients`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener pacientes');
      }
      const data = await response.json();
      setPatients(data || []);
      if (successMessage) {
        setMessage({ type: 'success', text: successMessage });
      }
    } catch (error) {
      setPatients([]);
      setMessage({ type: 'error', text: error.message || 'No se pudieron listar los pacientes.' });
    }

    setLoadingPatients(false);
  }, []);

  const loadTurns = useCallback(() => {
    try {
      const stored = window.localStorage.getItem('onco-salta-turns');
      if (stored) {
        setTurns(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('No se pudieron cargar los turnos locales.', error);
    }
  }, []);

  const persistTurns = useCallback((nextTurns) => {
    setTurns(nextTurns);
    try {
      window.localStorage.setItem('onco-salta-turns', JSON.stringify(nextTurns));
    } catch (error) {
      console.warn('No se pudieron guardar los turnos locales.', error);
    }
  }, []);

  const handleTurnSubmit = (event) => {
    event.preventDefault();
    setTurnsMessage({ type: '', text: '' });

    const selectedPatient = patients.find((p) => p.id === turnForm.patientId);
    if (!selectedPatient) {
      setTurnsMessage({ type: 'error', text: 'Selecciona un paciente válido para asignar el turno.' });
      return;
    }

    if (!turnForm.date || !turnForm.time) {
      setTurnsMessage({ type: 'error', text: 'Fecha y hora del turno son obligatorias.' });
      return;
    }

    setTurnSaving(true);
    const nextTurns = [
      ...turns,
      {
        id: `${Date.now()}-${selectedPatient.id}`,
        patientId: selectedPatient.id,
        patientName: selectedPatient.full_name,
        date: turnForm.date,
        time: turnForm.time,
        note: turnForm.note,
        status: 'scheduled',
      },
    ];

    persistTurns(nextTurns);
    setTurnsMessage({ type: 'success', text: 'Turno agregado correctamente.' });
    setTurnForm({ patientId: '', date: '', time: '', note: '' });
    setTurnSaving(false);
  };

  const handleUpdateTurnStatus = (turnId, status) => {
    const nextTurns = turns.map((item) => (item.id === turnId ? { ...item, status } : item));
    persistTurns(nextTurns);
  };

  const handleDeleteTurn = (turnId) => {
    const nextTurns = turns.filter((item) => item.id !== turnId);
    persistTurns(nextTurns);
  };

  const handleIaSubmit = async (event) => {
    event.preventDefault();
    setIaError('');
    setIaAnswer('');

    const patient = patients.find((p) => p.id === iaPatientId);
    if (!patient) {
      setIaError('Selecciona un paciente para consultar la IA.');
      return;
    }

    if (!iaQuestion.trim()) {
      setIaError('Escribe una pregunta para la IA.');
      return;
    }

    setIaLoading(true);

    try {
      const response = await fetch(`${API_URL}/ia/consult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientData: patient,
          question: iaQuestion,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error consultando IA');
      }

      setIaAnswer(result.answer || 'No se recibió respuesta de la IA.');
    } catch (error) {
      setIaError(error.message);
    } finally {
      setIaLoading(false);
    }
  };

  const sortedTurns = useMemo(() => {
    return [...turns].sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
  }, [turns]);

  const upcomingTurns = useMemo(() => sortedTurns.filter((item) => item.status === 'scheduled' || item.status === 'confirmed'), [sortedTurns]);
  const completedTurns = useMemo(() => sortedTurns.filter((item) => item.status === 'completed'), [sortedTurns]);
  const cancelledTurns = useMemo(() => sortedTurns.filter((item) => item.status === 'cancelled'), [sortedTurns]);

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
    loadTurns();
  }, [loadPatients, loadTurns]);

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

    try {
      // Construir el payload según el esquema esperado por la API
      const patientData = {
        datos_generales: {
          nombre_completo: formData.full_name,
          dni: formData.dni || null,
          fecha_nacimiento: formData.birth_date || null,
          sexo: formData.gender || 'No especificado',
          contacto: formData.contact || null
        },
        historia_tumoral: {
          ubicacion: formData.tumor_location || null,
          estadio: formData.tumor_stage || null,
          marcadores_moleculares: formData.molecular_markers || {},
          diagnostico_resumen: formData.diagnosis_summary || ''
        }
      };

      const response = await fetch(`${API_URL}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear paciente');
      }

      const result = await response.json();
      setPatients((current) => [result.patient, ...current]);
      
      // Limpiar el formulario
      setFormData({
        full_name: '',
        diagnosis_summary: '',
        status: 'active',
        dni: '',
        birth_date: '',
        gender: 'No especificado',
        contact: '',
        tumor_location: '',
        tumor_stage: '',
        molecular_markers: '',
      });
      
      setMessage({ type: 'success', text: `Paciente creado correctamente: ${result.patient.full_name}` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo crear el paciente.' });
    }

    setSavingPatient(false);
  };

  const handleDelete = async (patient) => {
    const confirmed = window.confirm(`¿Confirmás que querés eliminar a ${patient.full_name}?`);
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/patients/${patient.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar paciente');
      }

      setPatients((current) => current.filter((item) => item.id !== patient.id));
      setMessage({ type: 'success', text: `Paciente eliminado: ${patient.full_name}` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo eliminar el paciente.' });
    }
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

  const statusLabel = (status) => {
    const labels = {
      active: { text: 'Activo', color: '#16a34a', bg: '#dcfce7' },
      follow_up: { text: 'Seguimiento', color: '#d97706', bg: '#fef3c7' },
      discharged: { text: 'Alta', color: '#2563eb', bg: '#dbeafe' },
      deceased: { text: 'Fallecido', color: '#dc2626', bg: '#fee2e2' },
    };
    return labels[status] || { text: status || 'Desconocido', color: '#6b7280', bg: '#f3f4f6' };
  };

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <div className="app-shell__brand-logo">OSD</div>
          <div className="app-shell__brand-title">
            <strong>Onco-Salta Digital</strong>
            <span>Clínica oncológica inteligente</span>
          </div>
        </div>

        <div className="app-shell__user">
          <span>Sesión iniciada como</span>
          <strong>{user?.email || 'Médico'}</strong>
        </div>

        <button type="button" onClick={onSignOut} className="secondary" style={{ whiteSpace: 'nowrap' }}>
          Cerrar sesión
        </button>
      </header>

      <nav className="app-shell__nav">
        <button
          type="button"
          className={`main-nav-link ${activeSection === 'pacientes' ? 'main-nav-link--active' : ''}`}
          onClick={() => setActiveSection('pacientes')}
        >
          🧑‍⚕️ Pacientes
        </button>
        <button
          type="button"
          className={`main-nav-link ${activeSection === 'turnos' ? 'main-nav-link--active' : ''}`}
          onClick={() => setActiveSection('turnos')}
        >
          ⏱️ Turnos
        </button>
        <button
          type="button"
          className={`main-nav-link ${activeSection === 'ia' ? 'main-nav-link--active' : ''}`}
          onClick={() => setActiveSection('ia')}
        >
          🤖 IA
        </button>
        <button
          type="button"
          className={`main-nav-link ${activeSection === 'config' ? 'main-nav-link--active' : ''}`}
          onClick={() => setActiveSection('config')}
        >
          ⚙️ Configuración
        </button>
      </nav>

      <main className="main-content">
        <div className="page-grid">
          <section className="section-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>Bienvenido, {user?.email ? user.email.split('@')[0] : 'Doctor'}</h2>
                <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>
                  Plataforma clínica Onco-Salta Digital v1.0
                </p>
              </div>
              <div style={{ display: 'grid', gap: 6, textAlign: 'right' }}>
                <span style={{ color: 'var(--text-muted)' }}>Pacientes registrados</span>
                <strong style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>{patients.length}</strong>
              </div>
            </div>
          </section>

          <section className="summary-card">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <div className="turns-counter">
                <span>Turnos previstos</span>
                <strong>{upcomingTurns.length}</strong>
              </div>
              <div className="turns-counter">
                <span>Turnos confirmados</span>
                <strong>{sortedTurns.filter((item) => item.status === 'confirmed').length}</strong>
              </div>
              <div className="turns-counter">
                <span>Turnos cancelados</span>
                <strong>{cancelledTurns.length}</strong>
              </div>
            </div>
          </section>
        </div>

        {activeSection === 'pacientes' && (
          <div className="page-grid">
            <section className="section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0 }}>Registrar paciente</h2>
                  <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>Registra nuevos pacientes de forma rápida.</p>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>Atajos: Enter guarda · F5 recarga · Alt+S signos vitales</span>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
                <div className="form-grid">
                  <label>
                    Nombre completo <span style={{ color: '#b91c1c' }}>*</span>
                    <input
                      autoFocus
                      placeholder="Nombre y apellido"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </label>
                  <label>
                    DNI / Documento
                    <input
                      placeholder="Número de documento"
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                    />
                  </label>
                  <label>
                    Fecha de nacimiento
                    <input
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    />
                  </label>
                  <label>
                    Sexo
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    >
                      <option value="No especificado">No especificado</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </label>
                  <label>
                    Contacto
                    <input
                      placeholder="Ej. +54 387 1234567 o email"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    />
                  </label>
                  <label>
                    Estado clínico
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="active">Activo</option>
                      <option value="follow_up">Seguimiento</option>
                      <option value="discharged">Alta</option>
                      <option value="deceased">Fallecido</option>
                    </select>
                  </label>
                </div>

                <label>
                  Resumen del diagnóstico
                  <textarea
                    rows="3"
                    placeholder="Resumen breve del diagnóstico o patología"
                    value={formData.diagnosis_summary}
                    onChange={(e) => setFormData({ ...formData, diagnosis_summary: e.target.value })}
                  />
                </label>

                <button type="submit" className="primary" disabled={savingPatient || !formIsValid}>
                  {savingPatient ? 'Guardando paciente…' : '➕ Crear paciente'}
                </button>
              </form>
            </section>

            <section className="section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0 }}>Pacientes registrados</h2>
                  <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>Búsqueda, filtros y acciones rápidas.</p>
                </div>
                <button type="button" className="secondary" onClick={() => loadPatients(true, 'Lista actualizada.')}>Recargar lista</button>
              </div>

              <div className="form-grid" style={{ alignItems: 'end' }}>
                <input
                  type="text"
                  placeholder="Buscar por nombre o DNI..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="todos">Todos los estados</option>
                  <option value="active">Activo</option>
                  <option value="follow_up">Seguimiento</option>
                  <option value="discharged">Alta</option>
                  <option value="deceased">Fallecido</option>
                </select>
              </div>

              {message.text ? (
                <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, border: message.type === 'success' ? '1px solid #86efac' : '1px solid #fda4af', background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', color: message.type === 'success' ? '#166534' : '#b91c1c' }}>
                  {message.text}
                </div>
              ) : null}

              {patients.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No hay pacientes cargados todavía.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#334155', textAlign: 'left' }}>
                        <th style={{ padding: '12px 10px', borderBottom: '1px solid #e2e8f0' }}>Paciente</th>
                        <th style={{ padding: '12px 10px', borderBottom: '1px solid #e2e8f0' }}>Diagnóstico</th>
                        <th style={{ padding: '12px 10px', borderBottom: '1px solid #e2e8f0' }}>Estado</th>
                        <th style={{ padding: '12px 10px', borderBottom: '1px solid #e2e8f0' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPatients.map((patient, index) => (
                        <tr key={patient.id} style={{ background: index % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                          <td style={{ padding: '12px 10px' }}>
                            <strong>{patient.full_name}</strong>
                            <div style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 13 }}>
                              {[patient.dni && `DNI: ${patient.dni}`, patient.contact && `Contacto: ${patient.contact}`].filter(Boolean).join(' · ')}
                            </div>
                          </td>
                          <td style={{ padding: '12px 10px', color: '#475569' }}>{patient.diagnosis_summary || 'Sin diagnóstico'}</td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{ background: statusLabel(patient.status).bg, color: statusLabel(patient.status).color, padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700 }}>
                              {statusLabel(patient.status).text}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="secondary" onClick={() => navigate(`/patients/${patient.id}`)}>
                              👁️ Ver historial
                            </button>
                            <button type="button" className="secondary" onClick={() => handleOpenVitals(patient)}>
                              ❤️ Signos Vitales
                            </button>
                            <button type="button" className="secondary" onClick={() => handleEdit(patient)}>
                              ✏️ Editar
                            </button>
                            <button type="button" className="secondary" onClick={() => handleDelete(patient)}>
                              🗑️ Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {activeSection === 'turnos' && (
          <div className="page-grid">
            <section className="section-card">
              <h2>Turnos</h2>
              <p style={{ marginTop: 4, color: 'var(--text-muted)' }}>Administrá la agenda clínica y los turnos de pacientes.</p>

              {turnsMessage.text ? (
                <div style={{ margin: '16px 0', padding: '12px 14px', borderRadius: 12, border: turnsMessage.type === 'success' ? '1px solid #86efac' : '1px solid #fda4af', background: turnsMessage.type === 'success' ? '#f0fdf4' : '#fef2f2', color: turnsMessage.type === 'success' ? '#166534' : '#b91c1c' }}>
                  {turnsMessage.text}
                </div>
              ) : null}

              <form onSubmit={handleTurnSubmit} className="form-grid">
                <label>
                  Paciente
                  <select value={turnForm.patientId} onChange={(e) => setTurnForm({ ...turnForm, patientId: e.target.value })}>
                    <option value="">Selecciona un paciente</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Fecha
                  <input type="date" value={turnForm.date} onChange={(e) => setTurnForm({ ...turnForm, date: e.target.value })} />
                </label>
                <label>
                  Hora
                  <input type="time" value={turnForm.time} onChange={(e) => setTurnForm({ ...turnForm, time: e.target.value })} />
                </label>
                <label style={{ gridColumn: 'span 2' }}>
                  Nota rápida
                  <input type="text" placeholder="Ej. Control quimioterapia" value={turnForm.note} onChange={(e) => setTurnForm({ ...turnForm, note: e.target.value })} />
                </label>
                <button type="submit" className="primary" disabled={turnSaving || !turnForm.patientId || !turnForm.date || !turnForm.time}>
                  {turnSaving ? 'Guardando...' : 'Agregar turno'}
                </button>
              </form>
            </section>

            <section className="section-card">
              <h2>Agenda</h2>
              <div className="turns-overview">
                {sortedTurns.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No hay turnos agendados aún.</p>
                ) : (
                  <ul className="turns-list">
                    {sortedTurns.map((turn) => (
                      <li key={turn.id} className="turn-card">
                        <div className="turn-card__header">
                          <div>
                            <strong>{turn.patientName}</strong>
                            <div style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 13 }}>{turn.note || 'Sin nota'}</div>
                          </div>
                          <span className={`turn-card__pill turn-card__pill--${turn.status}`}>
                            {turn.status === 'scheduled' ? 'Agendado' : turn.status === 'confirmed' ? 'Confirmado' : turn.status === 'completed' ? 'Completado' : 'Cancelado'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <span>{turn.date} · {turn.time}</span>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="secondary" onClick={() => handleUpdateTurnStatus(turn.id, 'confirmed')}>Confirmar</button>
                            <button type="button" className="secondary" onClick={() => handleUpdateTurnStatus(turn.id, 'completed')}>Completar</button>
                            <button type="button" className="secondary" onClick={() => handleUpdateTurnStatus(turn.id, 'cancelled')}>Cancelar</button>
                            <button type="button" className="ghost" onClick={() => handleDeleteTurn(turn.id)}>Eliminar</button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        )}

        {activeSection === 'ia' && (
          <section className="section-card">
            <h2>IA</h2>
            <p style={{ color: 'var(--text-muted)' }}>Usá la IA integrada para consultas clínicas rápidas.</p>
            <form onSubmit={handleIaSubmit} style={{ display: 'grid', gap: 16, marginTop: 18 }}>
              <div className="form-grid">
                <label>
                  Paciente
                  <select value={iaPatientId} onChange={(e) => setIaPatientId(e.target.value)}>
                    <option value="">Selecciona un paciente</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </label>

                <label style={{ gridColumn: 'span 1' }}>
                  Consulta para IA
                  <textarea
                    rows="4"
                    placeholder="Ej. ¿Cuál es el siguiente paso terapéutico para este caso?"
                    value={iaQuestion}
                    onChange={(e) => setIaQuestion(e.target.value)}
                  />
                </label>
              </div>

              {iaError ? (
                <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #fca5a5', background: '#fef2f2', color: '#b91c1c' }}>
                  {iaError}
                </div>
              ) : null}

              <button type="submit" className="primary" disabled={iaLoading || !iaPatientId || !iaQuestion.trim()}>
                {iaLoading ? 'Consultando IA…' : 'Enviar consulta a IA'}
              </button>

              {iaAnswer ? (
                <div style={{ marginTop: 20, padding: '18px', borderRadius: 18, background: '#f8fafc', border: '1px solid rgba(37, 99, 235, 0.14)', color: '#0f172a' }}>
                  <strong>Respuesta de IA</strong>
                  <p style={{ margin: '10px 0 0', lineHeight: 1.8 }}>{iaAnswer}</p>
                </div>
              ) : null}
            </form>
          </section>
        )}

        {activeSection === 'config' && (
          <section className="section-card">
            <h2>Configuración</h2>
            <p style={{ color: 'var(--text-muted)' }}>Ajustá los parámetros de la plataforma y revisá las variables de entorno.</p>
            <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
              <div style={{ padding: 16, borderRadius: 18, background: '#f8fafc', border: '1px solid rgba(148, 163, 184, 0.16)' }}>
                <strong>API</strong>
                <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>La app usa `VITE_API_URL` para comunicar el frontend con el backend.</p>
              </div>
              <div style={{ padding: 16, borderRadius: 18, background: '#f8fafc', border: '1px solid rgba(148, 163, 184, 0.16)' }}>
                <strong>Supabase</strong>
                <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>Asegurate de que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` estén configuradas en Vercel.</p>
              </div>
            </div>
          </section>
        )}
      </main>
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