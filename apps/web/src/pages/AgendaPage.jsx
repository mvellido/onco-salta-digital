import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../lib/api';
import { useMe } from '../app/MeContext';
import SecretaryAgenda from '../features/secretary/SecretaryAgenda';

const EMPTY_TURN = { patientId: '', date: '', time: '', note: '' };
const STATUS_TEXT = { confirmed: 'confirmado', completed: 'completado', cancelled: 'cancelado', scheduled: 'reprogramado' };

export default function AgendaPage() {
  const { can } = useMe();
  const [patients, setPatients] = useState([]);
  const [turns, setTurns] = useState([]);
  const [turnForm, setTurnForm] = useState(EMPTY_TURN);
  const [turnSaving, setTurnSaving] = useState(false);
  const [editingTurnId, setEditingTurnId] = useState(null);
  const [turnsMessage, setTurnsMessage] = useState({ type: '', text: '' });
  const [turnsFilterStatus, setTurnsFilterStatus] = useState('all');
  const [turnsFilterPatient, setTurnsFilterPatient] = useState('');
  const [notificationForm, setNotificationForm] = useState({ channel: 'in-app', recipients: '', message: '' });
  const [notificationLoading, setNotificationLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [patientList, turnList] = await Promise.all([apiJson('/patients'), apiJson('/appointments')]);
      setPatients(patientList);
      setTurns(turnList);
    } catch (error) {
      setTurnsMessage({ type: 'error', text: error.message || 'No se pudo cargar la agenda.' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sortedTurns = useMemo(
    () => [...turns].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)),
    [turns]
  );

  const filteredTurns = useMemo(
    () => sortedTurns.filter((turn) =>
      (turnsFilterStatus === 'all' || turn.status === turnsFilterStatus)
      && (!turnsFilterPatient || turn.patientId === turnsFilterPatient)),
    [sortedTurns, turnsFilterStatus, turnsFilterPatient]
  );

  const turnCounters = useMemo(
    () => sortedTurns.reduce((acc, turn) => ({ ...acc, [turn.status]: (acc[turn.status] || 0) + 1 }), { scheduled: 0, confirmed: 0, completed: 0, cancelled: 0 }),
    [sortedTurns]
  );

  const resetTurnForm = () => {
    setTurnForm(EMPTY_TURN);
    setEditingTurnId(null);
  };

  const handleTurnSubmit = async (event) => {
    event.preventDefault();
    setTurnsMessage({ type: '', text: '' });

    if (!turnForm.patientId) {
      setTurnsMessage({ type: 'error', text: 'Elegí el paciente del turno.' });
      return;
    }
    if (!turnForm.date || !turnForm.time) {
      setTurnsMessage({ type: 'error', text: 'Fecha y hora del turno son obligatorias.' });
      return;
    }

    setTurnSaving(true);
    try {
      const payload = { patient_id: turnForm.patientId, date: turnForm.date, time: turnForm.time, note: turnForm.note };
      if (!editingTurnId) payload.status = 'scheduled';
      const result = await apiJson(`/appointments${editingTurnId ? `/${editingTurnId}` : ''}`, {
        method: editingTurnId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });

      if (editingTurnId) {
        setTurns((current) => current.map((item) => (item.id === editingTurnId ? result : item)));
        setTurnsMessage({ type: 'success', text: 'Turno actualizado.' });
      } else {
        setTurns((current) => [...current, result]);
        setTurnsMessage({ type: 'success', text: 'Turno agendado.' });
      }
      resetTurnForm();
    } catch (error) {
      setTurnsMessage({ type: 'error', text: error.message });
    } finally {
      setTurnSaving(false);
    }
  };

  const handleUpdateTurnStatus = async (turnId, status) => {
    try {
      const result = await apiJson(`/appointments/${turnId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setTurns((current) => current.map((item) => (item.id === turnId ? result : item)));
      setTurnsMessage({ type: 'success', text: `Turno ${STATUS_TEXT[status] || 'actualizado'}.` });
    } catch (error) {
      setTurnsMessage({ type: 'error', text: error.message });
    }
  };

  const handleDeleteTurn = async (turnId) => {
    try {
      await apiJson(`/appointments/${turnId}`, { method: 'DELETE' });
      setTurns((current) => current.filter((item) => item.id !== turnId));
      if (editingTurnId === turnId) resetTurnForm();
      setTurnsMessage({ type: 'success', text: 'Turno eliminado.' });
    } catch (error) {
      setTurnsMessage({ type: 'error', text: error.message });
    }
  };

  const handleSendNotification = async (event) => {
    event.preventDefault();
    setNotificationLoading(true);
    try {
      const recipients = notificationForm.recipients.split(',').map((item) => item.trim()).filter(Boolean);
      const result = await apiJson('/secretary/notifications', {
        method: 'POST',
        body: JSON.stringify({ channel: notificationForm.channel, recipients, message: notificationForm.message }),
      });
      setTurnsMessage({ type: 'success', text: `Aviso registrado (${result.recipients.length} destinatarios). Todavía no se envía por ${result.channel}.` });
      setNotificationForm({ channel: notificationForm.channel, recipients: '', message: '' });
    } catch (error) {
      setTurnsMessage({ type: 'error', text: error.message });
    } finally {
      setNotificationLoading(false);
    }
  };

  return (
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
      onEditTurn={(turn) => {
        setTurnForm({ patientId: turn.patientId, date: turn.date, time: turn.time, note: turn.note });
        setEditingTurnId(turn.id);
      }}
      onUpdateTurnStatus={handleUpdateTurnStatus}
      onDeleteTurn={handleDeleteTurn}
      notificationForm={notificationForm}
      setNotificationForm={setNotificationForm}
      notificationLoading={notificationLoading}
      onSendNotification={handleSendNotification}
      canNotify={can('notifications:send')}
    />
  );
}
