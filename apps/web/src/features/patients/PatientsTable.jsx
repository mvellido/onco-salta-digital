import { Archive, FolderOpen, RotateCcw, Search, ShieldCheck } from 'lucide-react';

export const STATUS_LABELS = {
  active: 'Activo',
  follow_up: 'Seguimiento',
  discharged: 'Alta',
  deceased: 'Fallecido',
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
  onOpenRecord,
  onArchive,
  onRestore,
  onOpenCoverage,
  canClinical,
  canArchive,
  showArchived,
  setShowArchived,
}) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="toolbar">
        <div>
          <h2>{showArchived ? 'Pacientes archivados' : 'Pacientes'}</h2>
          <p style={{ color: 'var(--muted)' }}>
            {showArchived ? 'Su historia clínica se conserva. Podés reactivarlos.' : `${patients.length} en seguimiento`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canArchive ? (
            <button type="button" className="secondary" aria-pressed={showArchived} onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? 'Ver activos' : 'Ver archivados'}
            </button>
          ) : null}
          <button type="button" className="secondary" onClick={onReload}>Recargar</button>
        </div>
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(160px, 1fr)' }}>
        <label className="visually-hidden" htmlFor="patient-search">Buscar paciente</label>
        <div style={{ position: 'relative' }}>
          <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: 11, top: 12, color: 'var(--faint)' }} />
          <input
            id="patient-search"
            type="search"
            placeholder="Buscar por nombre o DNI  (Ctrl+K)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
        <select aria-label="Filtrar por estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="todos">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {message.text ? (
        <div className={`message message--${message.type === 'success' ? 'success' : 'error'}`} role={message.type === 'success' ? 'status' : 'alert'}>
          {message.text}
        </div>
      ) : null}

      {patients.length === 0 ? (
        <div className="empty-state">
          {showArchived ? 'No hay pacientes archivados.' : 'Todavía no hay pacientes. Cargá el primero con el formulario.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Paciente</th>
                {canClinical ? <th>Diagnóstico</th> : null}
                <th>Estado</th>
                <th><span className="visually-hidden">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((patient) => (
                <tr key={patient.id}>
                  <td>
                    {canClinical ? (
                      <button type="button" className="secondary" style={{ border: 0, padding: 0, background: 'none', fontWeight: 700 }} onClick={() => onOpenRecord(patient.id)}>
                        {patient.full_name}
                      </button>
                    ) : <strong>{patient.full_name}</strong>}
                    <div className="mono" style={{ color: 'var(--muted)' }}>
                      {[patient.dni && `DNI ${patient.dni}`, patient.contact].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  {canClinical ? <td style={{ color: 'var(--muted)' }}>{patient.diagnosis_summary || '—'}</td> : null}
                  <td>
                    <span className={`status-pill status-pill--${patient.status}`}>{STATUS_LABELS[patient.status] || patient.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {canClinical && !showArchived ? (
                        <button type="button" className="secondary icon-button" onClick={() => onOpenRecord(patient.id)}>
                          <FolderOpen size={15} aria-hidden="true" /> Ficha
                        </button>
                      ) : null}
                      {onOpenCoverage && !showArchived ? (
                        <button type="button" className="secondary icon-button" onClick={() => onOpenCoverage(patient)}>
                          <ShieldCheck size={15} aria-hidden="true" /> Cobertura
                        </button>
                      ) : null}
                      {canArchive && !showArchived ? (
                        <button type="button" className="secondary icon-button" onClick={() => onArchive(patient)}>
                          <Archive size={15} aria-hidden="true" /> Archivar
                        </button>
                      ) : null}
                      {canArchive && showArchived ? (
                        <button type="button" className="secondary icon-button" onClick={() => onRestore(patient)}>
                          <RotateCcw size={15} aria-hidden="true" /> Reactivar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
