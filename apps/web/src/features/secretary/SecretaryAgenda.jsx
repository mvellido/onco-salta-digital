export default function SecretaryAgenda({
  patients,
  turns,
  turnForm,
  setTurnForm,
  turnSaving,
  editingTurnId,
  turnsMessage,
  turnsFilterStatus,
  setTurnsFilterStatus,
  turnsFilterPatient,
  setTurnsFilterPatient,
  turnCounters,
  filteredTurns,
  onSubmitTurn,
  onResetTurn,
  onEditTurn,
  onUpdateTurnStatus,
  onDeleteTurn,
  notificationForm,
  setNotificationForm,
  notificationLoading,
  onSendNotification,
  canNotify,
}) {
  return (
    <div className="page-grid">
      <section className="section-card">
        <h2>Secretaría y agenda</h2>
        <p style={{ marginTop: 4, color: 'var(--text-muted)' }}>Administrá turnos y avisos al equipo.</p>

        {turnsMessage.text ? (
          <div role={turnsMessage.type === 'success' ? 'status' : 'alert'} aria-live={turnsMessage.type === 'success' ? 'polite' : 'assertive'} style={{ margin: '16px 0', padding: '12px 14px', borderRadius: 12, border: turnsMessage.type === 'success' ? '1px solid #86efac' : '1px solid #fda4af', background: turnsMessage.type === 'success' ? '#f0fdf4' : '#fef2f2', color: turnsMessage.type === 'success' ? '#166534' : '#b91c1c' }}>
            {turnsMessage.text}
          </div>
        ) : null}

        <div className="turns-overview" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          <div className="turns-counter"><span>Agendados</span><strong>{turnCounters.scheduled}</strong></div>
          <div className="turns-counter"><span>Confirmados</span><strong>{turnCounters.confirmed}</strong></div>
          <div className="turns-counter"><span>Completados</span><strong>{turnCounters.completed}</strong></div>
          <div className="turns-counter"><span>Cancelados</span><strong>{turnCounters.cancelled}</strong></div>
        </div>

        <form onSubmit={onSubmitTurn} className="form-grid" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{editingTurnId ? 'Editar turno' : 'Nuevo turno'}</h3>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>{editingTurnId ? 'Modificá los datos y guardá los cambios.' : 'Cargá un nuevo turno en la agenda.'}</p>
            </div>
            {editingTurnId ? (
              <button type="button" className="secondary" onClick={onResetTurn}>Cancelar edición</button>
            ) : null}
          </div>

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
            {turnSaving ? 'Guardando...' : editingTurnId ? 'Guardar cambios' : 'Agregar turno'}
          </button>
        </form>
      </section>

      <section className="section-card">
        <div className="form-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', alignItems: 'end' }}>
          <label>
            Filtrar por estado
            <select value={turnsFilterStatus} onChange={(e) => setTurnsFilterStatus(e.target.value)}>
              <option value="all">Todos</option>
              <option value="scheduled">Agendados</option>
              <option value="confirmed">Confirmados</option>
              <option value="completed">Completados</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </label>

          <label>
            Filtrar por paciente
            <select value={turnsFilterPatient} onChange={(e) => setTurnsFilterPatient(e.target.value)}>
              <option value="">Todos los pacientes</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </label>
        </div>

        <h2>Agenda</h2>
        <div className="turns-overview">
          {filteredTurns.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>
              {turns.length === 0 ? 'No hay turnos agendados aún.' : 'No hay turnos que coincidan con el filtro seleccionado.'}
            </p>
          ) : (
            <ul className="turns-list">
              {filteredTurns.map((turn) => (
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
                  <div className="turn-card__details">
                    <span>{turn.date} · {turn.time}</span>
                    <span>{turn.status === 'confirmed' ? 'Confirmado' : turn.status === 'completed' ? 'Completado' : turn.status === 'cancelled' ? 'Cancelado' : 'Programado'}</span>
                  </div>
                  <div className="turn-card__footer">
                    <button type="button" className="secondary" onClick={() => onEditTurn(turn)}>Editar</button>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {turn.status === 'scheduled' && (
                        <button type="button" className="secondary" onClick={() => onUpdateTurnStatus(turn.id, 'confirmed')}>Confirmar</button>
                      )}
                      {(turn.status === 'scheduled' || turn.status === 'confirmed') && (
                        <button type="button" className="secondary" onClick={() => onUpdateTurnStatus(turn.id, 'completed')}>Completar</button>
                      )}
                      {turn.status !== 'cancelled' && turn.status !== 'completed' && (
                        <button type="button" className="secondary" onClick={() => onUpdateTurnStatus(turn.id, 'cancelled')}>Cancelar</button>
                      )}
                      <button type="button" className="ghost" onClick={() => onDeleteTurn(turn.id)}>Eliminar</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {canNotify ? (
      <section className="section-card">
        <h2>Avisos</h2>
        <p style={{ marginTop: 4, color: 'var(--text-muted)' }}>
          Todavía no hay un canal de envío conectado: el aviso queda registrado en la auditoría, pero no le llega a nadie.
        </p>
        <form onSubmit={onSendNotification} style={{ display: 'grid', gap: 10 }}>
          <label>
            Canal
            <select value={notificationForm.channel} onChange={(e) => setNotificationForm({ ...notificationForm, channel: e.target.value })}>
              <option value="in-app">In-app</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </label>
          <label>
            Destinatarios (separados por coma)
            <input
              type="text"
              value={notificationForm.recipients}
              onChange={(e) => setNotificationForm({ ...notificationForm, recipients: e.target.value })}
              placeholder="medico@onco.com, secretaria@onco.com"
            />
          </label>
          <label>
            Mensaje
            <textarea
              rows="3"
              value={notificationForm.message}
              onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
              placeholder="Mensaje para el equipo"
            />
          </label>
          <button type="submit" className="secondary" disabled={notificationLoading || !notificationForm.message.trim()}>
            {notificationLoading ? 'Registrando…' : 'Registrar aviso'}
          </button>
        </form>
      </section>
      ) : null}
    </div>
  );
}
