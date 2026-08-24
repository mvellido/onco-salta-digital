const statusLabel = (status) => {
  const labels = {
    active: { text: 'Activo', color: '#16a34a', bg: '#dcfce7' },
    follow_up: { text: 'Seguimiento', color: '#d97706', bg: '#fef3c7' },
    discharged: { text: 'Alta', color: '#2563eb', bg: '#dbeafe' },
    deceased: { text: 'Fallecido', color: '#dc2626', bg: '#fee2e2' },
  };
  return labels[status] || { text: status || 'Desconocido', color: '#6b7280', bg: '#f3f4f6' };
};

export default function PatientsTable({
  patients,
  filteredPatients,
  searchTerm,
  statusFilter,
  setSearchTerm,
  setStatusFilter,
  message,
  onReload,
  onViewHistory,
  onOpenVitals,
  onEdit,
  onDelete,
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Pacientes registrados</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>Búsqueda, filtros y acciones rápidas.</p>
        </div>
        <button type="button" className="secondary" onClick={onReload}>Recargar lista</button>
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
                    <button type="button" className="secondary" onClick={() => onViewHistory(patient.id)}>
                      👁️ Ver historial
                    </button>
                    <button type="button" className="secondary" onClick={() => onOpenVitals(patient)}>
                      ❤️ Signos Vitales
                    </button>
                    <button type="button" className="secondary" onClick={() => onEdit(patient)}>
                      ✏️ Editar
                    </button>
                    <button type="button" className="secondary" onClick={() => onDelete(patient)}>
                      🗑️ Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
