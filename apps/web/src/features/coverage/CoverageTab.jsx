import { useCallback, useEffect, useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { apiJson } from '../../lib/api';
import { formatDate } from '../record/catalog';
import AuthorizationCard, { PAYER_KINDS } from './AuthorizationCard';

const EMPTY_COVERAGE = { payer_id: '', member_number: '', plan: '', valid_to: '' };
const EMPTY_AUTH = { coverage_id: '', treatment_id: '', item: '', quantity: '', notes: '' };

// Pestaña Cobertura de la ficha: plan del paciente y autorizaciones.
export default function CoverageTab({ patientId, treatments = [], canWrite, preloaded = null }) {
  const [coverages, setCoverages] = useState(preloaded?.coverages || []);
  const [authorizations, setAuthorizations] = useState(preloaded?.authorizations || []);
  const [payers, setPayers] = useState(preloaded?.payers || []);
  const [coverageForm, setCoverageForm] = useState(null);
  const [authForm, setAuthForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (preloaded) return;
    try {
      const [c, a, p] = await Promise.all([
        apiJson(`/patients/${patientId}/coverages`),
        apiJson(`/authorizations?patient_id=${patientId}`),
        apiJson('/payers'),
      ]);
      setCoverages(c);
      setAuthorizations(a);
      setPayers(p);
    } catch (err) {
      setError(err.message);
    }
  }, [patientId, preloaded]);

  useEffect(() => {
    load();
  }, [load]);

  const saveCoverage = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = Object.fromEntries(Object.entries(coverageForm).filter(([, v]) => v !== ''));
      await apiJson(`/patients/${patientId}/coverages`, { method: 'POST', body: JSON.stringify(body) });
      setCoverageForm(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveAuthorization = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const coverage = coverages.find((c) => c.id === authForm.coverage_id) || coverages.find((c) => c.is_primary);
      const body = {
        item: authForm.item.trim(),
        ...(coverage ? { coverage_id: coverage.id, payer_id: coverage.payer_id } : {}),
        ...(authForm.treatment_id ? { treatment_id: authForm.treatment_id } : {}),
        ...(authForm.quantity.trim() ? { quantity: authForm.quantity.trim() } : {}),
        ...(authForm.notes.trim() ? { notes: authForm.notes.trim() } : {}),
      };
      const saved = await apiJson(`/patients/${patientId}/authorizations`, { method: 'POST', body: JSON.stringify(body) });
      setAuthorizations((current) => [saved, ...current]);
      setAuthForm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pickTreatment = (id) => {
    const treatment = treatments.find((t) => t.id === id);
    setAuthForm({
      ...authForm,
      treatment_id: id,
      item: treatment && !authForm.item ? [treatment.regimen, treatment.dose].filter(Boolean).join(' ') : authForm.item,
      quantity: treatment?.cycles_planned && !authForm.quantity ? `${treatment.cycles_planned} ciclos` : authForm.quantity,
    });
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {error ? <div className="message message--error" role="alert">{error}</div> : null}

      <section style={{ display: 'grid', gap: 10 }}>
        <div className="toolbar">
          <span className="eyebrow">Cobertura</span>
          {canWrite && !coverageForm ? (
            <button type="button" className="secondary icon-button" onClick={() => setCoverageForm(EMPTY_COVERAGE)}><Plus size={14} aria-hidden="true" /> Agregar cobertura</button>
          ) : null}
        </div>

        {coverages.length ? coverages.map((c) => (
          <div key={c.id} className="coverage-card">
            <ShieldCheck size={22} color="var(--teal)" aria-hidden="true" />
            <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <strong>{c.payer?.name}{c.is_primary ? <span className="pill pill--muted">Principal</span> : null}</strong>
              <span className="mono" style={{ color: 'var(--muted)' }}>
                {[PAYER_KINDS[c.payer?.kind], c.plan && `Plan ${c.plan}`, c.member_number && `Afiliado ${c.member_number}`, c.valid_to && `hasta ${formatDate(c.valid_to)}`].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>
        )) : <p style={{ color: 'var(--muted)' }}>Sin cobertura cargada.</p>}

        {coverageForm ? (
          <form onSubmit={saveCoverage} className="auth-card__form" style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
            <div className="form-grid">
              <label>
                Obra social o prepaga
                <select required value={coverageForm.payer_id} onChange={(e) => setCoverageForm({ ...coverageForm, payer_id: e.target.value })}>
                  <option value="">Elegí</option>
                  {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label>N.º de afiliado<input value={coverageForm.member_number} onChange={(e) => setCoverageForm({ ...coverageForm, member_number: e.target.value })} /></label>
              <label>Plan<input value={coverageForm.plan} onChange={(e) => setCoverageForm({ ...coverageForm, plan: e.target.value })} /></label>
              <label>Vigente hasta<input type="date" value={coverageForm.valid_to} onChange={(e) => setCoverageForm({ ...coverageForm, valid_to: e.target.value })} /></label>
            </div>
            {!payers.length ? <p style={{ color: 'var(--warn)', fontSize: '0.85rem' }}>Todavía no hay obras sociales cargadas. Se cargan en Finanzas → Obras sociales.</p> : null}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy || !coverageForm.payer_id}>Guardar cobertura</button>
              <button type="button" className="secondary" onClick={() => setCoverageForm(null)}>Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <div className="toolbar">
          <span className="eyebrow">Autorizaciones</span>
          {canWrite && !authForm ? (
            <button type="button" className="icon-button" disabled={!coverages.length} title={coverages.length ? '' : 'Primero cargá la cobertura'} onClick={() => setAuthForm({ ...EMPTY_AUTH, coverage_id: coverages.find((c) => c.is_primary)?.id || '' })}>
              <Plus size={14} aria-hidden="true" /> Pedir autorización
            </button>
          ) : null}
        </div>

        {authForm ? (
          <form onSubmit={saveAuthorization} className="auth-card__form" style={{ padding: 12, border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)' }}>
            <div className="form-grid">
              <label>
                Cobertura
                <select value={authForm.coverage_id} onChange={(e) => setAuthForm({ ...authForm, coverage_id: e.target.value })}>
                  {coverages.map((c) => <option key={c.id} value={c.id}>{c.payer?.name}{c.is_primary ? ' (principal)' : ''}</option>)}
                </select>
              </label>
              {treatments.length ? (
                <label>
                  Tratamiento
                  <select value={authForm.treatment_id} onChange={(e) => pickTreatment(e.target.value)}>
                    <option value="">—</option>
                    {treatments.map((t) => <option key={t.id} value={t.id}>{t.regimen}</option>)}
                  </select>
                </label>
              ) : null}
              <label>Cantidad<input value={authForm.quantity} onChange={(e) => setAuthForm({ ...authForm, quantity: e.target.value })} placeholder="Ej.: 6 ciclos" /></label>
            </div>
            <label>Qué se autoriza<input required minLength={3} value={authForm.item} onChange={(e) => setAuthForm({ ...authForm, item: e.target.value })} placeholder="Ej.: Pembrolizumab 200 mg" /></label>
            <label>Notas<input value={authForm.notes} onChange={(e) => setAuthForm({ ...authForm, notes: e.target.value })} /></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy || authForm.item.trim().length < 3}>Crear borrador</button>
              <button type="button" className="secondary" onClick={() => setAuthForm(null)}>Cancelar</button>
            </div>
          </form>
        ) : null}

        {authorizations.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {authorizations.map((a) => (
              <AuthorizationCard key={a.id} authorization={a} canWrite={canWrite} onChanged={(saved) => setAuthorizations((current) => current.map((x) => (x.id === saved.id ? saved : x)))} />
            ))}
          </div>
        ) : <p style={{ color: 'var(--muted)' }}>Sin autorizaciones.</p>}
      </section>
    </div>
  );
}
