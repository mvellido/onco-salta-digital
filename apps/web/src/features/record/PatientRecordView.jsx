import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FileImage, HeartPulse, History, Pill, Target } from 'lucide-react';
import GeneralTab from './GeneralTab';
import TumorTab from './TumorTab';
import TreatmentsTab from './TreatmentsTab';
import HistoryTab from './HistoryTab';
import StudiesTab from './StudiesTab';
import VitalsTab from './VitalsTab';
import RecordAIPanel from './RecordAIPanel';
import { ageFrom, siteLabel, tnmString } from './catalog';

export const TABS = [
  { id: 'resumen', label: 'Datos', icon: ClipboardList },
  { id: 'tumor', label: 'Tumor', icon: Target },
  { id: 'tratamientos', label: 'Tratamientos', icon: Pill },
  { id: 'historia', label: 'Historia', icon: History },
  { id: 'estudios', label: 'Estudios', icon: FileImage },
  { id: 'vitales', label: 'Vitales', icon: HeartPulse },
];

const isTyping = (target) => target instanceof HTMLElement
  && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

function RecordHeader({ patient, tumors, backTo }) {
  const age = ageFrom(patient.birth_date);
  const primary = tumors.find((t) => t.is_primary) || tumors[0];
  return (
    <header style={{ display: 'grid', gap: 8 }}>
      <Link to={backTo} className="record-header__back"><ArrowLeft size={15} aria-hidden="true" /> Pacientes</Link>
      <div className="record-header">
        <h1 className="record-header__name">
          {patient.full_name}
          <small>{[patient.dni && `DNI ${patient.dni}`, age != null && `${age} años`, patient.gender !== 'No especificado' && patient.gender].filter(Boolean).join(' · ')}</small>
        </h1>
        {primary ? <span className="chip">{[primary.histology, siteLabel(primary)].filter(Boolean).join(' · ')}</span> : null}
        {primary && (tnmString(primary) || primary.stage_group) ? (
          <span className="chip chip--teal">{[tnmString(primary), primary.stage_group && `Estadio ${primary.stage_group}`].filter(Boolean).join(' · ')}</span>
        ) : null}
        {patient.ecog != null ? <span className="chip chip--muted">ECOG {patient.ecog}</span> : null}
        {(patient.allergies || []).map((allergy) => <span key={allergy} className="chip chip--alert">Alergia: {allergy}</span>)}
        {patient.archived_at ? <span className="chip chip--warn">Archivado</span> : null}
      </div>
    </header>
  );
}

function ShortcutsCard() {
  return (
    <aside className="side-card record-shortcuts" aria-label="Atajos de teclado">
      <h2>Atajos</h2>
      <div className="shortcut-list">
        <kbd>1–6</kbd><span>Pestañas de la ficha</span>
        <kbd>N</kbd><span>Nuevo evento</span>
        <kbd>/</kbd><span>Preguntar a la IA</span>
        <kbd>Alt+1…5</kbd><span>Secciones</span>
        <kbd>Ctrl+K</kbd><span>Buscar paciente</span>
        <kbd>?</kbd><span>Ver atajos</span>
        <kbd>Esc</kbd><span>Cerrar visor</span>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
        Las letras y números funcionan cuando no estás escribiendo en un campo.
      </p>
    </aside>
  );
}

// Ficha clínica completa. No hace pedidos propios salvo las pestañas que leen de
// Supabase (historia, estudios, vitales); el resto llega por props.
export default function PatientRecordView({
  record,
  user,
  canWrite,
  canUseAI,
  initialTab = 'resumen',
  onTabChange,
  onUpdatePatient,
  onSaveTumor,
  onSaveTreatment,
  backTo = '/pacientes',
  demo = null,
}) {
  const [tab, setTab] = useState(TABS.some((t) => t.id === initialTab) ? initialTab : 'resumen');
  const [timeline, setTimeline] = useState(record.timeline || []);
  const [showHelp, setShowHelp] = useState(false);
  const aiInputRef = useRef(null);
  const writable = canWrite && !record.archived_at;

  const changeTab = useCallback((next) => {
    setTab(next);
    onTabChange?.(next);
  }, [onTabChange]);

  const handleEventsChange = useCallback((events) => setTimeline(events), []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return;
      if (document.querySelector('.lightbox')) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && TABS[index]) {
        event.preventDefault();
        changeTab(TABS[index].id);
      } else if (event.key === '/') {
        event.preventDefault();
        aiInputRef.current?.focus();
      } else if (event.key.toLowerCase() === 'n' && writable) {
        event.preventDefault();
        changeTab('historia');
        setTimeout(() => document.querySelector('.detail-card textarea')?.focus(), 50);
      } else if (event.key === '?') {
        event.preventDefault();
        setShowHelp((current) => !current);
      } else if (event.key === 'Escape') {
        setShowHelp(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [changeTab, writable]);

  const studiesEvents = useMemo(() => timeline.map(({ id, event_type, event_date }) => ({ id, event_type, event_date })), [timeline]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <RecordHeader patient={record} tumors={record.tumors} backTo={backTo} />

      {record.archived_at ? (
        <div className="message message--error">
          Paciente archivado ({record.archive_reason}). La ficha es de solo lectura; reactivalo desde la lista para cargar datos.
        </div>
      ) : null}

      <div className="record-layout">
        <ShortcutsCard />

        <section className="record-main">
          <div className="record-tabs" role="tablist" aria-label="Secciones de la ficha">
            {TABS.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-selected={tab === item.id}
                  aria-controls="record-panel"
                  className="record-tab"
                  title={`Tecla ${index + 1}`}
                  onClick={() => changeTab(item.id)}
                >
                  <Icon size={16} aria-hidden="true" /> {item.label}
                </button>
              );
            })}
          </div>

          <div className="record-panel" id="record-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === 'resumen' ? (
              <GeneralTab patient={record} tumors={record.tumors} treatments={record.treatments} timeline={timeline} canWrite={writable} onUpdatePatient={onUpdatePatient} />
            ) : null}
            {tab === 'tumor' ? (
              <TumorTab tumors={record.tumors} gender={record.gender} canWrite={writable} onSaveTumor={onSaveTumor} />
            ) : null}
            {tab === 'tratamientos' ? (
              <TreatmentsTab treatments={record.treatments} tumors={record.tumors} canWrite={writable} onSaveTreatment={onSaveTreatment} />
            ) : null}
            {tab === 'historia' ? (
              <HistoryTab patientId={record.id} user={user} canWrite={writable} initialEvents={demo ? timeline : null} onEventsChange={handleEventsChange} />
            ) : null}
            {tab === 'estudios' ? <StudiesTab events={studiesEvents} preloaded={demo?.attachments || null} /> : null}
            {tab === 'vitales' ? <VitalsTab patientId={record.id} canWrite={writable} preloaded={demo?.vitals || null} /> : null}
          </div>
        </section>

        <RecordAIPanel
          ref={aiInputRef}
          patientId={record.id}
          enabled={canUseAI && !demo}
          disabledReason={demo ? 'En la vista de ejemplo la IA no está conectada.' : 'Tu rol no tiene acceso al asistente IA.'}
        />
      </div>

      {showHelp ? (
        <div className="shortcut-overlay" role="dialog" aria-modal="true" aria-label="Atajos de teclado" onClick={() => setShowHelp(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <ShortcutsCard />
          </div>
        </div>
      ) : null}
    </div>
  );
}

