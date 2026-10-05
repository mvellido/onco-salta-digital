import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../app/supabaseClient';
import { formatDate } from './catalog';

const EMPTY = { systolic: '', diastolic: '', heartRate: '', temperature: '', weight: '', height: '', oxygenSaturation: '' };

// Umbrales orientativos para adultos; marcan el dato, no reemplazan el criterio clínico.
export function getVitalsAlerts(v) {
  const alerts = [];
  const sys = v.systolic ? Number(v.systolic) : null;
  const dia = v.diastolic ? Number(v.diastolic) : null;
  if (sys !== null || dia !== null) {
    if ((sys ?? 0) >= 140 || (dia ?? 0) >= 90) alerts.push({ level: 'alert', text: 'Hipertensión' });
    else if ((sys !== null && sys < 90) || (dia !== null && dia < 60)) alerts.push({ level: 'alert', text: 'Hipotensión' });
    else if ((sys ?? 0) >= 120 || (dia ?? 0) >= 80) alerts.push({ level: 'warn', text: 'Presión elevada' });
  }
  if (v.heartRate) {
    const hr = Number(v.heartRate);
    if (hr > 100) alerts.push({ level: 'alert', text: 'Taquicardia (>100 lpm)' });
    else if (hr < 60) alerts.push({ level: 'warn', text: 'Bradicardia (<60 lpm)' });
  }
  if (v.temperature) {
    const t = Number(v.temperature);
    if (t >= 38) alerts.push({ level: 'alert', text: 'Fiebre (≥38 °C): descartar neutropenia febril' });
    else if (t >= 37.3) alerts.push({ level: 'warn', text: 'Febrícula' });
    else if (t < 35) alerts.push({ level: 'alert', text: 'Hipotermia' });
  }
  if (v.oxygenSaturation) {
    const o2 = Number(v.oxygenSaturation);
    if (o2 < 90) alerts.push({ level: 'alert', text: 'Hipoxemia severa (<90%)' });
    else if (o2 < 95) alerts.push({ level: 'warn', text: 'Hipoxemia leve' });
  }
  return alerts;
}

function WeightSparkline({ records }) {
  const points = records.filter((r) => r.weight != null).slice(0, 12).reverse();
  if (points.length < 2) return null;
  const weights = points.map((p) => Number(p.weight));
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;
  const w = 240;
  const h = 56;
  const coords = weights.map((value, i) => [8 + (i * (w - 16)) / (weights.length - 1), 8 + (1 - (value - min) / span) * (h - 16)]);
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords.at(-1)[0].toFixed(1)} ${h} L${coords[0][0].toFixed(1)} ${h} Z`;
  const first = weights[0];
  const last = weights.at(-1);
  const change = ((last - first) / first) * 100;
  const [lx, ly] = coords.at(-1);

  return (
    <div style={{ display: 'grid', gap: 6 }}>
    <span className="eyebrow">Peso · últimos registros</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Peso de ${first} a ${last} kg`}>
        <path d={area} fill="var(--accent-soft)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" />
        <circle cx={lx} cy={ly} r="3.5" fill="var(--accent-strong)" />
      </svg>
      <div>
        <strong className="mono">{last} kg</strong>
        <div className={`chip ${change <= -5 ? 'chip--alert' : 'chip--muted'}`} style={{ marginTop: 4 }}>
          {change > 0 ? '+' : ''}{change.toFixed(1)}% desde {formatDate(points[0].recorded_at)}
        </div>
      </div>
    </div>
    </div>
  );
}

export default function VitalsTab({ patientId, canWrite, preloaded = null }) {
  const [form, setForm] = useState(EMPTY);
  const [records, setRecords] = useState(preloaded || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const alerts = useMemo(() => getVitalsAlerts(form), [form]);

  const load = useCallback(async () => {
    if (preloaded) return;
    const { data, error } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('patient_id', patientId)
      .order('recorded_at', { ascending: false })
      .limit(20);
    if (error) setMessage({ type: 'error', text: 'No se pudieron cargar los signos vitales.' });
    else setRecords(data || []);
  }, [patientId, preloaded]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const num = (value, parse = Number) => (value === '' ? null : parse(value));

  const submit = async (event) => {
    event.preventDefault();
    if (Object.values(form).every((value) => value === '')) {
      setMessage({ type: 'error', text: 'Cargá al menos un valor.' });
      return;
    }
    setSaving(true);
    setMessage({ type: '', text: '' });
    const { error } = await supabase.from('vital_signs').insert([{
      patient_id: patientId,
      blood_pressure_systolic: num(form.systolic, (v) => parseInt(v, 10)),
      blood_pressure_diastolic: num(form.diastolic, (v) => parseInt(v, 10)),
      heart_rate: num(form.heartRate, (v) => parseInt(v, 10)),
      temperature: num(form.temperature, parseFloat),
      weight: num(form.weight, parseFloat),
      height: num(form.height, parseFloat),
      oxygen_saturation: num(form.oxygenSaturation, (v) => parseInt(v, 10)),
    }]);
    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: /check constraint/i.test(error.message) ? 'Algún valor está fuera de rango. Revisalo.' : 'No se pudieron guardar los signos vitales.' });
      return;
    }
    setForm(EMPTY);
    setMessage({ type: 'success', text: 'Signos vitales registrados.' });
    load();
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <WeightSparkline records={records} />

      {canWrite ? (
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <span className="eyebrow">Nuevo registro</span>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
            <label>PA sistólica<input id="vs-sys" type="number" inputMode="numeric" value={form.systolic} onChange={set('systolic')} placeholder="mmHg" /></label>
            <label>PA diastólica<input id="vs-dia" type="number" inputMode="numeric" value={form.diastolic} onChange={set('diastolic')} placeholder="mmHg" /></label>
            <label>Frecuencia cardíaca<input id="vs-hr" type="number" inputMode="numeric" value={form.heartRate} onChange={set('heartRate')} placeholder="lpm" /></label>
            <label>Temperatura<input id="vs-temp" type="number" step="0.1" value={form.temperature} onChange={set('temperature')} placeholder="°C" /></label>
            <label>Saturación O₂<input id="vs-o2" type="number" inputMode="numeric" value={form.oxygenSaturation} onChange={set('oxygenSaturation')} placeholder="%" /></label>
            <label>Peso<input id="vs-weight" type="number" step="0.1" value={form.weight} onChange={set('weight')} placeholder="kg" /></label>
            <label>Talla<input id="vs-height" type="number" step="0.1" value={form.height} onChange={set('height')} placeholder="cm" /></label>
          </div>
          {alerts.length ? (
            <div className="chip-row" aria-live="polite">
              {alerts.map((alert) => <span key={alert.text} className={`chip ${alert.level === 'alert' ? 'chip--alert' : 'chip--warn'}`}>{alert.text}</span>)}
            </div>
          ) : null}
          <button type="submit" disabled={saving} style={{ justifySelf: 'start' }}>{saving ? 'Guardando…' : 'Registrar'}</button>
        </form>
      ) : null}

      {message.text ? <div className={`message message--${message.type === 'success' ? 'success' : 'error'}`}>{message.text}</div> : null}

      {records.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Fecha</th><th>PA</th><th>FC</th><th>T °C</th><th>SatO₂</th><th>Peso</th></tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{formatDate(r.recorded_at)}</td>
                  <td className="mono">{r.blood_pressure_systolic ? `${r.blood_pressure_systolic}/${r.blood_pressure_diastolic ?? '—'}` : '—'}</td>
                  <td className="mono">{r.heart_rate ?? '—'}</td>
                  <td className="mono">{r.temperature ?? '—'}</td>
                  <td className="mono">{r.oxygen_saturation != null ? `${r.oxygen_saturation}%` : '—'}</td>
                  <td className="mono">{r.weight != null ? `${r.weight} kg` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p style={{ color: 'var(--muted)' }}>Sin registros todavía.</p>}
    </div>
  );
}
