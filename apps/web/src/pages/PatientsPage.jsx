import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { useMe } from '../app/MeContext';
import PatientRegistrationForm, { EMPTY_PATIENT_FORM } from '../features/patients/PatientRegistrationForm';
import PatientsTable from '../features/patients/PatientsTable';
import CoverageTab from '../features/coverage/CoverageTab';

export default function PatientsPage() {
  const { me, can } = useMe();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showArchived, setShowArchived] = useState(false);
  const [archivingPatient, setArchivingPatient] = useState(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [formData, setFormData] = useState(EMPTY_PATIENT_FORM);
  const [savingPatient, setSavingPatient] = useState(false);
  const [doctors, setDoctors] = useState(null);
  const [coveragePatient, setCoveragePatient] = useState(null);

  const canWrite = can('patients:write');
  const assignsDoctor = canWrite && me.role !== 'doctor' && can('users:manage');

  const loadPatients = useCallback(async (successText = '') => {
    try {
      setPatients(await apiJson(showArchived ? '/patients?archived=true' : '/patients'));
      setMessage(successText ? { type: 'success', text: successText } : { type: '', text: '' });
    } catch (error) {
      setPatients([]);
      setMessage({ type: 'error', text: error.message || 'No se pudieron listar los pacientes.' });
    }
  }, [showArchived]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    if (!assignsDoctor) return;
    apiJson('/admin/users')
      .then(({ users }) => setDoctors(users.filter((user) => user.role === 'doctor' && user.active)))
      .catch(() => setDoctors([]));
  }, [assignsDoctor]);

  // Ctrl+K enfoca el buscador
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('patient-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredPatients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesSearch = !term
        || patient.full_name.toLowerCase().includes(term)
        || (patient.dni || '').toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'todos' || patient.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [patients, searchTerm, statusFilter]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setSavingPatient(true);
    setMessage({ type: '', text: '' });

    const payload = {
      datos_generales: {
        nombre_completo: formData.full_name.trim(),
        sexo: formData.gender,
        ...(formData.dni.trim() ? { dni: formData.dni.trim() } : {}),
        ...(formData.birth_date ? { fecha_nacimiento: formData.birth_date } : {}),
        ...(formData.contact.trim() ? { contacto: formData.contact.trim() } : {}),
      },
      historia_tumoral: { diagnostico_resumen: formData.diagnosis_summary.trim() },
      ...(assignsDoctor ? { assigned_doctor_id: formData.assigned_doctor_id } : {}),
    };

    try {
      const { patient } = await apiJson('/patients', { method: 'POST', body: JSON.stringify(payload) });
      setFormData(EMPTY_PATIENT_FORM);
      navigate(`/pacientes/${patient.id}?tab=tumor`);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo crear el paciente.' });
    } finally {
      setSavingPatient(false);
    }
  };

  const handleArchive = async (event) => {
    event.preventDefault();
    try {
      await apiJson(`/patients/${archivingPatient.id}/archive`, { method: 'POST', body: JSON.stringify({ reason: archiveReason.trim() }) });
      setPatients((current) => current.filter((item) => item.id !== archivingPatient.id));
      setMessage({ type: 'success', text: `Paciente archivado: ${archivingPatient.full_name}. Su historia clínica se conserva.` });
      setArchivingPatient(null);
      setArchiveReason('');
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleRestore = async (patient) => {
    try {
      await apiJson(`/patients/${patient.id}/restore`, { method: 'POST' });
      setPatients((current) => current.filter((item) => item.id !== patient.id));
      setMessage({ type: 'success', text: `Paciente reactivado: ${patient.full_name}` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  return (
    <div className={canWrite ? 'split-layout' : 'page-grid'}>
      <section className="section-card">
        <PatientsTable
          patients={patients}
          filteredPatients={filteredPatients}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          setSearchTerm={setSearchTerm}
          setStatusFilter={setStatusFilter}
          message={message}
          onReload={() => loadPatients('Lista actualizada.')}
          onOpenRecord={(id) => navigate(`/pacientes/${id}`)}
          onArchive={(patient) => { setArchivingPatient(patient); setArchiveReason(''); }}
          onRestore={handleRestore}
          onOpenCoverage={can('coverage:manage') && !can('patients:read') ? setCoveragePatient : undefined}
          canClinical={can('patients:read')}
          canArchive={can('patients:archive')}
          showArchived={showArchived}
          setShowArchived={setShowArchived}
        />

        {coveragePatient ? (
          <div className="read-panel" style={{ marginTop: 16 }}>
            <div className="toolbar">
              <div>
                <span className="eyebrow">Cobertura y autorizaciones</span>
                <h3>{coveragePatient.full_name}</h3>
              </div>
              <button type="button" className="secondary" onClick={() => setCoveragePatient(null)}>Cerrar</button>
            </div>
            <CoverageTab key={coveragePatient.id} patientId={coveragePatient.id} canWrite />
          </div>
        ) : null}

        {archivingPatient ? (
          <form onSubmit={handleArchive} className="archive-panel" aria-label="Archivar paciente">
            <strong>Archivar a {archivingPatient.full_name}</strong>
            <p>Deja de aparecer en la lista activa. Su historia clínica, adjuntos y auditoría se conservan y podés reactivarlo cuando quieras.</p>
            <label>
              Motivo
              <input id="archive-reason" type="text" value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} placeholder="Ej.: derivado a otro centro, carga duplicada" autoFocus required minLength={3} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={archiveReason.trim().length < 3}>Archivar</button>
              <button type="button" className="secondary" onClick={() => setArchivingPatient(null)}>Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      {canWrite ? (
        <section className="section-card">
          <span className="eyebrow">Nuevo ingreso</span>
          <h2 style={{ marginBottom: 12 }}>Registrar paciente</h2>
          <PatientRegistrationForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleCreate}
            savingPatient={savingPatient}
            doctors={assignsDoctor ? doctors || [] : null}
          />
        </section>
      ) : null}
    </div>
  );
}
