import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { useMe } from '../app/MeContext';
import PatientRecordView from '../features/record/PatientRecordView';

export default function PatientRecordPage() {
  const { patientId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { me, can } = useMe();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setError('');
    apiJson(`/patients/${patientId}`)
      .then((data) => { if (!cancelled) setRecord(data); })
      .catch((err) => { if (!cancelled) setError(err.status === 404 ? 'Paciente no encontrado o sin permisos.' : err.message); });
    return () => { cancelled = true; };
  }, [patientId]);

  const onTabChange = useCallback((tab) => {
    setSearchParams(tab === 'resumen' ? {} : { tab }, { replace: true });
  }, [setSearchParams]);

  const onUpdatePatient = async (changes) => {
    const updated = await apiJson(`/patients/${patientId}`, { method: 'PUT', body: JSON.stringify(changes) });
    setRecord((current) => ({ ...current, ...updated }));
    return updated;
  };

  const onSaveTumor = async (tumorId, payload) => {
    const saved = await apiJson(tumorId ? `/tumors/${tumorId}` : `/patients/${patientId}/tumors`, {
      method: tumorId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    setRecord((current) => ({
      ...current,
      tumors: tumorId ? current.tumors.map((t) => (t.id === tumorId ? saved : t)) : [...current.tumors, saved],
    }));
    return saved;
  };

  const onSaveTreatment = async (treatmentId, payload) => {
    const saved = await apiJson(treatmentId ? `/treatments/${treatmentId}` : `/patients/${patientId}/treatments`, {
      method: treatmentId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    setRecord((current) => ({
      ...current,
      treatments: treatmentId ? current.treatments.map((t) => (t.id === treatmentId ? saved : t)) : [saved, ...current.treatments],
    }));
    return saved;
  };

  if (error) return <div className="section-card"><div className="message message--error">{error}</div></div>;
  if (!record) return <p style={{ color: 'var(--muted)' }}>Cargando ficha…</p>;

  return (
    <PatientRecordView
      key={record.id}
      record={record}
      user={{ id: me.id }}
      canWrite={can('patients:write')}
      canUseAI={can('ai:use')}
      initialTab={searchParams.get('tab') || 'resumen'}
      onTabChange={onTabChange}
      onUpdatePatient={onUpdatePatient}
      onSaveTumor={onSaveTumor}
      onSaveTreatment={onSaveTreatment}
    />
  );
}
