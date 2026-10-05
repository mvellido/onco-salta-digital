import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';
import { buildPatientContextBlock, ageFromBirthDate } from '../src/modules/ai/service.js';
import { validateTreatmentRules, normalizeTnm } from '../src/modules/clinical/service.js';

const TUMOR = {
  primary_site: 'lung',
  laterality: 'left',
  site_detail: 'LSI periférico',
  histology: 'Adenocarcinoma',
  size_mm: 35,
  t_category: 't2a',
  n_category: 'n1',
  m_category: 'm0',
  stage_group: 'iib',
  biomarkers: [{ name: 'PD-L1', result: '60%' }, { name: 'EGFR', result: 'negativo' }],
};

test('el médico carga un tumor con TNM normalizado y queda auditado', async () => {
  const { call, supabase } = setup();
  const res = await call('tok-doc', 'POST', '/patients/p1/tumors', TUMOR);
  assert.equal(res.statusCode, 201);
  const tumor = res.json();
  assert.equal(tumor.t_category, 'T2a');
  assert.equal(tumor.stage_group, 'IIB');
  assert.equal(tumor.created_by, 'u-doc');
  assert.ok(supabase.db.audit_logs.some((log) => log.action === 'tumor_create' && log.patient_id === 'p1'));
});

test('un sitio primario fuera del catálogo se rechaza', async () => {
  const { call } = setup();
  const res = await call('tok-doc', 'POST', '/patients/p1/tumors', { primary_site: 'pulmon' });
  assert.equal(res.statusCode, 400);
});

test('no se puede cargar un tumor en un paciente ajeno', async () => {
  const { call } = setup();
  const res = await call('tok-doc', 'POST', '/patients/p2/tumors', TUMOR);
  assert.equal(res.statusCode, 404);
});

test('secretaría no carga datos clínicos', async () => {
  const { call } = setup();
  const res = await call('tok-sec', 'POST', '/patients/p1/tumors', TUMOR);
  assert.equal(res.statusCode, 403);
});

test('la ficha devuelve tumores y tratamientos', async () => {
  const { call } = setup();
  await call('tok-doc', 'POST', '/patients/p1/tumors', TUMOR);
  await call('tok-doc', 'POST', '/patients/p1/treatments', { kind: 'immunotherapy', regimen: 'Pembrolizumab', status: 'active', cycles_planned: 6, cycles_done: 1 });
  const res = await call('tok-doc', 'GET', '/patients/p1');
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().tumors.length, 1);
  assert.equal(res.json().treatments[0].regimen, 'Pembrolizumab');
});

test('un tratamiento no puede apuntar al tumor de otro paciente', async () => {
  const { call, supabase } = setup();
  supabase.db.tumors = [{ id: 't-ajeno', patient_id: 'p2', primary_site: 'lung' }];
  const res = await call('tok-doc', 'POST', '/patients/p1/treatments', { kind: 'chemotherapy', regimen: 'Carboplatino', tumor_id: 't-ajeno' });
  assert.equal(res.statusCode, 400);
});

test('suspender un tratamiento exige motivo, también al editar', async () => {
  const { call } = setup();
  const created = await call('tok-doc', 'POST', '/patients/p1/treatments', { kind: 'chemotherapy', regimen: 'Carboplatino + Pemetrexed', status: 'active' });
  const id = created.json().id;
  const sinMotivo = await call('tok-doc', 'PUT', `/treatments/${id}`, { status: 'suspended' });
  assert.equal(sinMotivo.statusCode, 400);
  const conMotivo = await call('tok-doc', 'PUT', `/treatments/${id}`, { status: 'suspended', suspension_reason: 'Neutropenia grado 4' });
  assert.equal(conMotivo.statusCode, 200);
});

test('ECOG fuera de rango se rechaza; el válido registra la fecha', async () => {
  const { call, supabase } = setup();
  assert.equal((await call('tok-doc', 'PUT', '/patients/p1', { ecog: 5 })).statusCode, 400);
  const res = await call('tok-doc', 'PUT', '/patients/p1', { ecog: 1, allergies: ['Platino', ' platino ', 'Platino'] });
  assert.equal(res.statusCode, 200);
  const row = supabase.db.patients.find((p) => p.id === 'p1');
  assert.ok(row.ecog_updated_at);
  assert.deepEqual(row.allergies, ['Platino', 'platino']);
});

test('reglas de tratamiento', () => {
  assert.match(validateTreatmentRules({ start_date: '2026-05-01', end_date: '2026-04-01' }), /fin/);
  assert.match(validateTreatmentRules({ cycles_planned: 4, cycles_done: 5 }), /ciclos/);
  assert.equal(validateTreatmentRules({ status: 'active' }), null);
  assert.equal(normalizeTnm(' n1mi '), 'N1mi');
});

test('el contexto para la IA lleva edad y TNM, pero no la fecha de nacimiento', () => {
  const block = buildPatientContextBlock({
    full_name: 'Juana Ejemplo',
    birth_date: '1968-03-15',
    ecog: 1,
    allergies: ['Platino'],
    tumors: [{ primary_site: 'lung', laterality: 'left', tnm_prefix: 'c', t_category: 'T2a', n_category: 'N1', m_category: 'M0', stage_group: 'IIB', biomarkers: [{ name: 'PD-L1', result: '60%' }] }],
    treatments: [{ kind: 'immunotherapy', regimen: 'Pembrolizumab', status: 'active', cycles_planned: 6, cycles_done: 2 }],
  });
  assert.doesNotMatch(block, /Juana|1968-03-15/);
  assert.match(block, /cT2a N1 M0/);
  assert.match(block, /PD-L1 60%/);
  assert.match(block, /ciclos 2\/6/);
  assert.equal(ageFromBirthDate('1968-03-15', new Date('2026-03-14T12:00:00')), 57);
  assert.equal(ageFromBirthDate('1968-03-15', new Date('2026-03-15T12:00:00')), 58);
});
