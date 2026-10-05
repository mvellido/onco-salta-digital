import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { apiJson } from '../../lib/api';
import { WEEKDAYS } from './agendaUtils';

// Horario semanal de atención de un profesional (franjas por día).
export default function ScheduleEditor({ professional, onSaved, onClose }) {
  const [blocks, setBlocks] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson(`/professionals/${professional.id}/schedule`)
      .then((rows) => setBlocks(rows.map(({ weekday, start_time, end_time, slot_minutes, resource }) => ({ weekday, start_time, end_time, slot_minutes, resource: resource || '' }))))
      .catch((err) => setError(err.message));
  }, [professional.id]);

  const update = (index, field, value) => setBlocks(blocks.map((b, i) => (i === index ? { ...b, [field]: value } : b)));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = blocks.map((b) => ({ weekday: Number(b.weekday), start_time: b.start_time, end_time: b.end_time, slot_minutes: Number(b.slot_minutes || 30), resource: b.resource.trim() || null }));
      const saved = await apiJson(`/professionals/${professional.id}/schedule`, { method: 'PUT', body: JSON.stringify({ blocks: payload }) });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="side-card agenda-form" aria-label="Horario de atención">
      <div className="toolbar">
        <div>
          <span className="eyebrow">Horario de atención</span>
          <h2>{professional.full_name || professional.email}</h2>
        </div>
        <button type="button" className="secondary" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
      </div>

      {!blocks ? <p style={{ color: 'var(--muted)' }}>Cargando…</p> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {blocks.map((block, index) => (
            <div key={index} className="schedule-row">
              <select aria-label="Día" value={block.weekday} onChange={(e) => update(index, 'weekday', Number(e.target.value))}>
                {WEEKDAYS.map((day, i) => <option key={day} value={i + 1}>{day}</option>)}
              </select>
              <input aria-label="Desde" type="time" step="900" value={block.start_time} onChange={(e) => update(index, 'start_time', e.target.value)} />
              <input aria-label="Hasta" type="time" step="900" value={block.end_time} onChange={(e) => update(index, 'end_time', e.target.value)} />
              <input aria-label="Minutos por turno" type="number" min="5" max="240" step="5" value={block.slot_minutes} onChange={(e) => update(index, 'slot_minutes', e.target.value)} />
              <button type="button" className="ghost" aria-label="Quitar franja" onClick={() => setBlocks(blocks.filter((_, i) => i !== index))}><X size={15} /></button>
            </div>
          ))}
          <button type="button" className="chip-button icon-button" style={{ justifySelf: 'start' }}
            onClick={() => setBlocks([...blocks, { weekday: 1, start_time: '09:00', end_time: '13:00', slot_minutes: 30, resource: '' }])}>
            <Plus size={14} aria-hidden="true" /> Agregar franja
          </button>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Día · desde · hasta · minutos por turno. Los turnos fuera de horario se pueden dar igual, con aviso.</p>
          {error ? <div className="message message--error">{error}</div> : null}
          <button type="button" disabled={saving} onClick={save} style={{ justifySelf: 'start' }}>{saving ? 'Guardando…' : 'Guardar horario'}</button>
        </div>
      )}
    </aside>
  );
}
