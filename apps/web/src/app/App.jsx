import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, Link } from 'react-router-dom';
import PatientDetail from './PatientDetail';
import { supabase } from './supabaseClient';
import { useClinicalShortcuts } from '../components/useClinicalShortcuts';
import PatientRegistrationForm from '../features/patients/PatientRegistrationForm';
import PatientsTable from '../features/patients/PatientsTable';
import AIAssistantPanel from '../features/ai/AIAssistantPanel';
import BillingDashboard from '../features/billing/BillingDashboard';
import SecretaryAgenda from '../features/secretary/SecretaryAgenda';
import AdminUsersPanel, { ROLE_LABELS } from '../features/admin/AdminUsersPanel';
import { apiFetch, apiJson } from '../lib/api';
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
      <h1>Onco-Salta Digital</h1>
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

function Dashboard({ user, onSignOut }) {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [meError, setMeError] = useState('');
  const can = useCallback((permission) => Boolean(me?.permissions?.includes(permission)), [me]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivingPatient, setArchivingPatient] = useState(null);
  const [archiveReason, setArchiveReason] = useState('');
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
  const [editingTurnId, setEditingTurnId] = useState(null);
  const [turnsMessage, setTurnsMessage] = useState({ type: '', text: '' });
  const [turnsFilterStatus, setTurnsFilterStatus] = useState('all');
  const [turnsFilterPatient, setTurnsFilterPatient] = useState('');
  const [notificationForm, setNotificationForm] = useState({ channel: 'in-app', recipients: '', message: '' });
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [iaPatientId, setIaPatientId] = useState('');
  const [iaQuestion, setIaQuestion] = useState('');
  const [iaAnswer, setIaAnswer] = useState('');
  const [iaLoading, setIaLoading] = useState(false);
  const [iaError, setIaError] = useState('');
  const [iaIngestLoading, setIaIngestLoading] = useState(false);
  const [iaIngestResult, setIaIngestResult] = useState('');
  const [iaDocumentReference, setIaDocumentReference] = useState('');
  const [iaDocumentRawText, setIaDocumentRawText] = useState('');
  const [billingReport, setBillingReport] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState({ type: '', text: '' });
  const [billingForm, setBillingForm] = useState({
    patient_id: '',
    invoice_number: '',
    amount: '',
    status: 'pending',
    notes: '',
  });
  const [reconForm, setReconForm] = useState({ expectedTotal: '', recordsJson: '' });
  const [reconResult, setReconResult] = useState(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('pacientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const formIsValid = useMemo(() => formData.full_name.trim().length > 0, [formData.full_name]);

  const parseMolecularMarkers = (value) => {
    if (!value || typeof value !== 'string' || !value.trim()) {
      return {};
    }

    try {
      return JSON.parse(value);
    } catch {
      return { nota: value.trim() };
    }
  };

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
      const response = await apiFetch(showArchived ? '/patients?archived=true' : '/patients');
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
  }, [showArchived]);

  const loadTurns = useCallback(async () => {
    try {
      const response = await apiFetch('/appointments');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener turnos');
      }
      const data = await response.json();
      setTurns(data || []);
    } catch (error) {
      console.warn('No se pudieron cargar los turnos desde el backend.', error);
      setTurns([]);
      setTurnsMessage({ type: 'error', text: 'No se pudieron cargar los turnos desde el servidor.' });
    }
  }, []);

  const loadBillingReport = useCallback(async () => {
    setBillingLoading(true);
    setBillingMessage((current) => (current.type === 'error' ? { type: '', text: '' } : current));

    try {
      const response = await apiFetch('/billing/reports');
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo cargar el reporte financiero');
      }

      setBillingReport(result);
    } catch (error) {
      setBillingReport(null);
      setBillingMessage({ type: 'error', text: error.message || 'No se pudo cargar el reporte financiero.' });
    } finally {
      setBillingLoading(false);
    }
  }, []);

  const resetTurnForm = () => {
    setTurnForm({ patientId: '', date: '', time: '', note: '' });
    setEditingTurnId(null);
    setTurnSaving(false);
  };

  const handleEditTurn = (turn) => {
    setTurnForm({
      patientId: turn.patientId,
      date: turn.date,
      time: turn.time,
      note: turn.note,
    });
    setEditingTurnId(turn.id);
    setTurnsMessage({ type: '', text: '' });
  };

  const handleTurnSubmit = async (event) => {
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

    try {
      const payload = {
        patient_id: selectedPatient.id,
        date: turnForm.date,
        time: turnForm.time,
        note: turnForm.note,
        status: editingTurnId ? undefined : 'scheduled',
      };

      const response = await apiFetch(
        `/appointments${editingTurnId ? `/${editingTurnId}` : ''}`,
        {
          method: editingTurnId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error guardando el turno');
      }

      if (editingTurnId) {
        setTurns((current) => current.map((item) => (item.id === editingTurnId ? result : item)));
        setTurnsMessage({ type: 'success', text: 'Turno actualizado correctamente.' });
        resetTurnForm();
      } else {
        setTurns((current) => [...current, result]);
        setTurnsMessage({ type: 'success', text: 'Turno agregado correctamente.' });
        setTurnForm({ patientId: '', date: '', time: '', note: '' });
      }
    } catch (error) {
      console.error('Error saving appointment:', error);
      setTurnsMessage({ type: 'error', text: error.message || 'Error guardando el turno.' });
    } finally {
      setTurnSaving(false);
    }
  };

  const handleUpdateTurnStatus = async (turnId, status) => {
    setTurnsMessage({ type: '', text: '' });

    try {
      const response = await apiFetch(`/appointments/${turnId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error actualizando estado del turno');
      }

      setTurns((current) => current.map((item) => (item.id === turnId ? result : item)));
      const statusText = status === 'confirmed' ? 'confirmado' : status === 'completed' ? 'completado' : 'cancelado';
      setTurnsMessage({ type: 'success', text: `Turno ${statusText} correctamente.` });
    } catch (error) {
      console.error('Error updating appointment status:', error);
      setTurnsMessage({ type: 'error', text: error.message || 'No se pudo actualizar el estado del turno.' });
    }
  };

  const handleDeleteTurn = async (turnId) => {
    setTurnsMessage({ type: '', text: '' });

    try {
      const response = await apiFetch(`/appointments/${turnId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error eliminando el turno');
      }

      setTurns((current) => current.filter((item) => item.id !== turnId));
      if (editingTurnId === turnId) {
        resetTurnForm();
      }
      setTurnsMessage({ type: 'success', text: result.message || 'Turno eliminado correctamente.' });
    } catch (error) {
      console.error('Error deleting appointment:', error);
      setTurnsMessage({ type: 'error', text: error.message || 'No se pudo eliminar el turno.' });
    }
  };

  const handleSendSecretaryNotification = async (event) => {
    event.preventDefault();
    setNotificationLoading(true);
    setTurnsMessage({ type: '', text: '' });

    try {
      const recipients = notificationForm.recipients
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const response = await apiFetch('/secretary/notifications', {
        method: 'POST',
        body: JSON.stringify({
          channel: notificationForm.channel,
          recipients,
          message: notificationForm.message,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo enviar la notificación');
      }

      setTurnsMessage({ type: 'success', text: `Aviso registrado (${result.recipients.length} destinatarios). Todavía no se envía por ${result.channel}.` });
      setNotificationForm({ channel: notificationForm.channel, recipients: '', message: '' });
    } catch (error) {
      setTurnsMessage({ type: 'error', text: error.message || 'No se pudo enviar la notificación.' });
    } finally {
      setNotificationLoading(false);
    }
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
      const response = await apiFetch('/ai/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          patientId: patient.id,
          clinicalQuestion: iaQuestion,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error consultando IA');
      }

      setIaAnswer(result.recommendations || result.answer || 'No se recibió respuesta de la IA.');
    } catch (error) {
      setIaError(error.message);
    } finally {
      setIaLoading(false);
    }
  };

  const handleIaChat = async () => {
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
      const response = await apiFetch('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          patientId: patient.id,
          message: iaQuestion,
          history: [],
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error consultando chat IA');
      }

      setIaAnswer(result.answer || 'No se recibió respuesta del chat IA.');
    } catch (error) {
      setIaError(error.message);
    } finally {
      setIaLoading(false);
    }
  };

  const handleIaIngest = async () => {
    setIaError('');
    setIaIngestResult('');

    const patient = patients.find((p) => p.id === iaPatientId);
    if (!patient) {
      setIaError('Selecciona un paciente para la ingesta documental.');
      return;
    }

    if (!iaDocumentReference.trim() && !iaDocumentRawText.trim()) {
      setIaError('Debes ingresar una referencia de documento o texto OCR para ingesta.');
      return;
    }

    setIaIngestLoading(true);

    try {
      const response = await apiFetch('/ai/ingest', {
        method: 'POST',
        body: JSON.stringify({
          patientId: patient.id,
          documentReference: iaDocumentReference.trim() || undefined,
          rawText: iaDocumentRawText.trim() || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error en ingesta de documento');
      }

      setIaIngestResult(result.parsedSummary || 'Documento procesado sin resumen textual.');
    } catch (error) {
      setIaError(error.message);
    } finally {
      setIaIngestLoading(false);
    }
  };

  const handleCreateBillingRecord = async (event) => {
    event.preventDefault();
    setBillingMessage({ type: '', text: '' });

    if (!billingForm.patient_id || !billingForm.invoice_number.trim() || !billingForm.amount) {
      setBillingMessage({ type: 'error', text: 'Paciente, número de factura y monto son obligatorios.' });
      return;
    }

    setBillingLoading(true);
    try {
      const payload = {
        patient_id: billingForm.patient_id,
        invoice_number: billingForm.invoice_number.trim(),
        amount: Number(billingForm.amount),
        status: billingForm.status,
        notes: billingForm.notes || undefined,
      };

      const response = await apiFetch('/billing/records', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo crear la factura');
      }

      setBillingMessage({ type: 'success', text: `Factura registrada: ${result.invoice_number}` });
      setBillingForm({ patient_id: '', invoice_number: '', amount: '', status: 'pending', notes: '' });
      await loadBillingReport();
    } catch (error) {
      setBillingMessage({ type: 'error', text: error.message || 'No se pudo crear la factura.' });
    } finally {
      setBillingLoading(false);
    }
  };

  const handleRunConciliation = async (event) => {
    event.preventDefault();
    setBillingMessage({ type: '', text: '' });
    setReconResult(null);

    let records;
    try {
      records = JSON.parse(reconForm.recordsJson);
    } catch {
      setBillingMessage({ type: 'error', text: 'El lote de conciliación no es un JSON válido.' });
      return;
    }

    if (!Array.isArray(records) || records.length === 0) {
      setBillingMessage({ type: 'error', text: 'Debes enviar un arreglo de registros para conciliar.' });
      return;
    }

    setReconLoading(true);
    try {
      const response = await apiFetch('/billing/conciliate', {
        method: 'POST',
        body: JSON.stringify({
          records,
          expectedTotal: reconForm.expectedTotal ? Number(reconForm.expectedTotal) : null,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo ejecutar la conciliación');
      }

      setReconResult(result);
      setBillingMessage({ type: 'success', text: 'Conciliación ejecutada correctamente.' });
    } catch (error) {
      setBillingMessage({ type: 'error', text: error.message || 'No se pudo ejecutar la conciliación.' });
    } finally {
      setReconLoading(false);
    }
  };

  const sortedTurns = useMemo(() => {
    return [...turns].sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
  }, [turns]);

  const filteredTurns = useMemo(() => {
    return sortedTurns.filter((turn) => {
      const matchesStatus = turnsFilterStatus === 'all' || turn.status === turnsFilterStatus;
      const matchesPatient = !turnsFilterPatient || turn.patientId === turnsFilterPatient;
      return matchesStatus && matchesPatient;
    });
  }, [sortedTurns, turnsFilterStatus, turnsFilterPatient]);

  const turnCounters = useMemo(() => {
    return sortedTurns.reduce(
      (counters, turn) => {
        counters[turn.status] = (counters[turn.status] || 0) + 1;
        return counters;
      },
      { scheduled: 0, confirmed: 0, completed: 0, cancelled: 0 }
    );
  }, [sortedTurns]);

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
    apiJson('/me')
      .then(setMe)
      .catch((error) => setMeError(error.message || 'No se pudo cargar tu perfil.'));
  }, []);

  useEffect(() => {
    if (!me) return;
    if (me.permissions.includes('patients:read') || me.permissions.includes('patients:read_basic')) loadPatients();
  }, [me, loadPatients]);

  useEffect(() => {
    if (!me) return;
    if (me.permissions.includes('appointments:read')) loadTurns();
    if (me.permissions.includes('billing:read')) loadBillingReport();
  }, [me, loadTurns, loadBillingReport]);

  // Carga automática al cambiar de paciente en el formulario
  useEffect(() => {
    loadLatestVitals(vitalsForm.patientId);
  }, [vitalsForm.patientId, loadLatestVitals]);

  useClinicalShortcuts({
    onToggleVitals: () => setVitalsOpen((current) => !current),
    onRefreshPatients: () => loadPatients(true, 'Lista actualizada.'),
    onSectionChange: (section) => setActiveSection(section),
  });

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
          marcadores_moleculares: parseMolecularMarkers(formData.molecular_markers),
          diagnostico_resumen: formData.diagnosis_summary || ''
        }
      };

      const response = await apiFetch('/patients', {
        method: 'POST',
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

  const handleArchive = async (event) => {
    event.preventDefault();
    if (!archivingPatient) return;

    try {
      const response = await apiFetch(`/patients/${archivingPatient.id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ reason: archiveReason.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudo archivar el paciente');
      }

      setPatients((current) => current.filter((item) => item.id !== archivingPatient.id));
      setMessage({ type: 'success', text: `Paciente archivado: ${archivingPatient.full_name}. Su historia clínica se conserva.` });
      setArchivingPatient(null);
      setArchiveReason('');
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo archivar el paciente.' });
    }
  };

  const handleRestore = async (patient) => {
    try {
      const response = await apiFetch(`/patients/${patient.id}/restore`, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudo reactivar el paciente');
      }

      setPatients((current) => current.filter((item) => item.id !== patient.id));
      setMessage({ type: 'success', text: `Paciente reactivado: ${patient.full_name}` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo reactivar el paciente.' });
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

    const response = await apiFetch(`/patients/${editingPatient.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        full_name: editingFormData.full_name,
        diagnosis_summary: editingFormData.diagnosis_summary,
        status: editingFormData.status,
        dni: editingFormData.dni || null,
        birth_date: editingFormData.birth_date || null,
        gender: editingFormData.gender || 'No especificado',
        contact: editingFormData.contact || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      setMessage({ type: 'error', text: errorData.error || 'No se pudo actualizar el paciente.' });
      setSavingPatient(false);
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

  if (meError) {
    return (
      <div className="auth-page">
        <h1>Sin acceso</h1>
        <p>{meError}</p>
        <button type="button" onClick={onSignOut}>Cerrar sesión</button>
      </div>
    );
  }

  if (!me) {
    return <div style={{ padding: 24 }}>Cargando permisos…</div>;
  }

  const canSeePatients = can('patients:read') || can('patients:read_basic');
  const sections = [
    { id: 'pacientes', label: '🧑‍⚕️ Pacientes', aria: 'Sección de pacientes', visible: canSeePatients },
    { id: 'turnos', label: '⏱️ Turnos', aria: 'Sección de secretaría y turnos', visible: can('appointments:read') },
    { id: 'ia', label: '🤖 IA', aria: 'Sección de asistencia IA', visible: can('ai:use') && can('patients:read') },
    { id: 'finanzas', label: '💳 Finanzas', aria: 'Sección financiera', visible: can('billing:read') },
    { id: 'config', label: '⚙️ Configuración', aria: 'Sección de configuración', visible: true },
  ].filter((section) => section.visible);
  const currentSection = sections.some((section) => section.id === activeSection) ? activeSection : sections[0].id;

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
          <span>{ROLE_LABELS[me.role] || 'Sesión iniciada'}</span>
          <strong>{me.full_name || user?.email}</strong>
        </div>

        <button type="button" onClick={onSignOut} className="secondary" style={{ whiteSpace: 'nowrap' }}>
          Cerrar sesión
        </button>
      </header>

      <nav className="app-shell__nav">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`main-nav-link ${currentSection === section.id ? 'main-nav-link--active' : ''}`}
            onClick={() => setActiveSection(section.id)}
            aria-label={section.aria}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <main className="main-content">
        <div className="page-grid">
          <section className="section-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>Hola, {me.full_name || user?.email?.split('@')[0]}</h2>
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

        {currentSection === 'pacientes' && (
          <div className="page-grid">
            {can('patients:write') ? (
            <section className="section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0 }}>Registrar paciente</h2>
                  <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>Registra nuevos pacientes de forma rápida.</p>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>Atajos: Enter guarda · F5 recarga · Alt+S signos vitales</span>
              </div>

              <PatientRegistrationForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                savingPatient={savingPatient}
                formIsValid={formIsValid}
              />
            </section>
            ) : null}

            <section className="section-card">
              <PatientsTable
                patients={patients}
                filteredPatients={filteredPatients}
                searchTerm={searchTerm}
                statusFilter={statusFilter}
                setSearchTerm={setSearchTerm}
                setStatusFilter={setStatusFilter}
                message={message}
                onReload={() => loadPatients(true, 'Lista actualizada.')}
                onViewHistory={(patientId) => navigate(`/patients/${patientId}`)}
                onOpenVitals={handleOpenVitals}
                onEdit={handleEdit}
                onArchive={(patient) => { setArchivingPatient(patient); setArchiveReason(''); }}
                onRestore={handleRestore}
                canClinical={can('patients:read')}
                canWrite={can('patients:write')}
                canArchive={can('patients:archive')}
                showArchived={showArchived}
                setShowArchived={setShowArchived}
              />

              {archivingPatient ? (
                <form onSubmit={handleArchive} className="archive-panel" aria-label="Archivar paciente">
                  <strong>Archivar a {archivingPatient.full_name}</strong>
                  <p>El paciente deja de aparecer en la lista activa. Su historia clínica, adjuntos y auditoría se conservan y podés reactivarlo cuando quieras.</p>
                  <label>
                    Motivo
                    <input
                      id="archive-reason"
                      type="text"
                      value={archiveReason}
                      onChange={(e) => setArchiveReason(e.target.value)}
                      placeholder="Ej.: derivado a otro centro, carga duplicada"
                      autoFocus
                      required
                      minLength={3}
                    />
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={archiveReason.trim().length < 3}>Archivar</button>
                    <button type="button" className="secondary" onClick={() => setArchivingPatient(null)}>Cancelar</button>
                  </div>
                </form>
              ) : null}
            </section>
          </div>
        )}

        {currentSection === 'turnos' && (
          <SecretaryAgenda
            patients={patients}
            turns={turns}
            turnForm={turnForm}
            setTurnForm={setTurnForm}
            turnSaving={turnSaving}
            editingTurnId={editingTurnId}
            turnsMessage={turnsMessage}
            turnsFilterStatus={turnsFilterStatus}
            setTurnsFilterStatus={setTurnsFilterStatus}
            turnsFilterPatient={turnsFilterPatient}
            setTurnsFilterPatient={setTurnsFilterPatient}
            turnCounters={turnCounters}
            filteredTurns={filteredTurns}
            onSubmitTurn={handleTurnSubmit}
            onResetTurn={resetTurnForm}
            onEditTurn={handleEditTurn}
            onUpdateTurnStatus={handleUpdateTurnStatus}
            onDeleteTurn={handleDeleteTurn}
            notificationForm={notificationForm}
            setNotificationForm={setNotificationForm}
            notificationLoading={notificationLoading}
            onSendNotification={handleSendSecretaryNotification}
            canNotify={can('notifications:send')}
          />
        )}

        {currentSection === 'ia' && (
          <AIAssistantPanel
            patients={patients}
            iaPatientId={iaPatientId}
            setIaPatientId={setIaPatientId}
            iaQuestion={iaQuestion}
            setIaQuestion={setIaQuestion}
            iaAnswer={iaAnswer}
            iaError={iaError}
            iaLoading={iaLoading}
            onAskRecommendations={handleIaSubmit}
            onAskChat={handleIaChat}
            documentReference={iaDocumentReference}
            setDocumentReference={setIaDocumentReference}
            documentRawText={iaDocumentRawText}
            setDocumentRawText={setIaDocumentRawText}
            ingestLoading={iaIngestLoading}
            ingestResult={iaIngestResult}
            onIngestDocument={handleIaIngest}
          />
        )}

        {currentSection === 'finanzas' && (
          <BillingDashboard
            patients={patients}
            billingReport={billingReport}
            billingLoading={billingLoading}
            billingMessage={billingMessage}
            billingForm={billingForm}
            setBillingForm={setBillingForm}
            onCreateBillingRecord={handleCreateBillingRecord}
            reconForm={reconForm}
            setReconForm={setReconForm}
            reconResult={reconResult}
            reconLoading={reconLoading}
            onRunConciliation={handleRunConciliation}
            onReloadReport={loadBillingReport}
          />
        )}

        {currentSection === 'config' && (
          can('users:manage') ? (
            <AdminUsersPanel currentUserId={me.id} />
          ) : (
            <section className="section-card">
              <h2>Configuración</h2>
              <p style={{ color: 'var(--text-muted)' }}>
                Tu rol es <strong>{ROLE_LABELS[me.role]}</strong>. Para cambiar permisos o invitar personas, hablá con el administrador del centro.
              </p>
            </section>
          )
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
        <Route path="/bienvenida" element={<SetPasswordPage user={user} />} />
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