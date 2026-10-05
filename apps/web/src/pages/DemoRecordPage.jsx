import { useState } from 'react';
import PatientRecordView from '../features/record/PatientRecordView';
import { DEMO_ATTACHMENTS, DEMO_COVERAGE, DEMO_RECORD, DEMO_VITALS } from '../features/record/demoRecord';

// Ficha con datos ficticios para revisar el diseño sin tocar la base.
// Solo se registra la ruta en desarrollo (ver App.jsx). Los cambios quedan en memoria.
export default function DemoRecordPage() {
  const [record, setRecord] = useState(DEMO_RECORD);
  const nextId = () => `demo-${Date.now()}`;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="message message--error" role="note">
        Vista de ejemplo con datos ficticios. Nada de lo que cargues acá se guarda.
      </div>
      <PatientRecordView
        record={record}
        user={{ id: 'demo-user' }}
        canWrite
        canUseAI
        backTo="/demo/ficha"
        demo={{ attachments: DEMO_ATTACHMENTS, vitals: DEMO_VITALS, coverage: DEMO_COVERAGE }}
        onUpdatePatient={async (changes) => {
          setRecord((current) => ({ ...current, ...changes, ...('ecog' in changes ? { ecog_updated_at: new Date().toISOString() } : {}) }));
        }}
        onSaveTumor={async (id, payload) => {
          const saved = { ...payload, id: id || nextId() };
          setRecord((current) => ({ ...current, tumors: id ? current.tumors.map((t) => (t.id === id ? saved : t)) : [...current.tumors, saved] }));
          return saved;
        }}
        onSaveTreatment={async (id, payload) => {
          setRecord((current) => {
            const base = id ? current.treatments.find((t) => t.id === id) : {};
            const saved = { ...base, ...payload, id: id || nextId() };
            return { ...current, treatments: id ? current.treatments.map((t) => (t.id === id ? saved : t)) : [saved, ...current.treatments] };
          });
        }}
      />
    </div>
  );
}
