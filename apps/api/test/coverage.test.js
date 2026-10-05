import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';
import { applyAuthorizationChange, withExpiry } from '../src/modules/coverage/index.js';

const TABLES = {
  payers: [{ id: 'os1', name: 'Obra Social Ejemplo', kind: 'obra_social', active: true }, { id: 'os2', name: 'Prepaga Ejemplo', kind: 'prepaga', active: true }],
  treatments: [{ id: 'tx1', patient_id: 'p1', kind: 'immunotherapy', regimen: 'Pembrolizumab' }, { id: 'tx2', patient_id: 'p2', kind: 'chemotherapy', regimen: 'X' }],
};

test('transiciones de estado de una autorización', () => {
  assert.ok(applyAuthorizationChange({ status: 'draft' }, { status: 'approved', authorization_number: '1' }).error, 'no se aprueba un borrador sin presentarlo');
  assert.match(applyAuthorizationChange({ status: 'submitted' }, { status: 'approved' }).error, /número/);
  const submitted = applyAuthorizationChange({ status: 'draft' }, { status: 'submitted' });
  assert.match(submitted.changes.requested_on, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(applyAuthorizationChange({ status: 'rejected' }, { status: 'submitted' }).changes, 'se puede volver a presentar');
  assert.ok(applyAuthorizationChange({ status: 'approved' }, { status: 'submitted' }).error);
});

test('vencimiento próximo y vencido', () => {
  assert.equal(withExpiry({ status: 'approved', valid_until: '2026-10-20' }, '2026-10-12').expiry, 'soon');
  assert.equal(withExpiry({ status: 'approved', valid_until: '2026-10-01' }, '2026-10-12').expiry, 'expired');
  assert.equal(withExpiry({ status: 'approved', valid_until: '2026-12-31' }, '2026-10-12').expiry, null);
  assert.equal(withExpiry({ status: 'submitted', valid_until: '2026-10-01' }, '2026-10-12').expiry, null);
});

test('secretaría carga la cobertura; una nueva primaria reemplaza la anterior', async () => {
  const { call, supabase } = setup({ extraTables: TABLES });
  const first = await call('tok-sec', 'POST', '/patients/p1/coverages', { payer_id: 'os1', member_number: '123/00' });
  assert.equal(first.statusCode, 201, first.body);
  const second = await call('tok-sec', 'POST', '/patients/p1/coverages', { payer_id: 'os2', plan: '210' });
  assert.equal(second.statusCode, 201);
  const primaries = supabase.db.patient_coverages.filter((c) => c.patient_id === 'p1' && c.is_primary);
  assert.deepEqual(primaries.map((c) => c.payer_id), ['os2']);
});

test('un médico no puede cargar cobertura de un paciente ajeno', async () => {
  const { call } = setup({ extraTables: TABLES });
  const res = await call('tok-doc', 'POST', '/patients/p2/coverages', { payer_id: 'os1' });
  assert.equal(res.statusCode, 404);
});

test('ciclo de una autorización: borrador, presentada, aprobada con número', async () => {
  const { call, supabase } = setup({ extraTables: TABLES });
  const coverage = (await call('tok-sec', 'POST', '/patients/p1/coverages', { payer_id: 'os1' })).json();

  const created = await call('tok-doc', 'POST', '/patients/p1/authorizations', { coverage_id: coverage.id, treatment_id: 'tx1', item: 'Pembrolizumab 200 mg x 6 ciclos' });
  assert.equal(created.statusCode, 201, created.body);
  assert.equal(created.json().payer_id, 'os1', 'toma la obra social de la cobertura');
  const id = created.json().id;

  assert.equal((await call('tok-sec', 'PATCH', `/authorizations/${id}`, { status: 'submitted' })).statusCode, 200);
  const noNumber = await call('tok-sec', 'PATCH', `/authorizations/${id}`, { status: 'approved' });
  assert.equal(noNumber.statusCode, 400);
  const approved = await call('tok-sec', 'PATCH', `/authorizations/${id}`, { status: 'approved', authorization_number: 'A-555', valid_until: '2027-01-31' });
  assert.equal(approved.statusCode, 200);
  assert.equal(approved.json().status, 'approved');
  assert.ok(supabase.db.audit_logs.some((l) => l.action === 'authorization_update' && l.details.to === 'approved'));

  const board = await call('tok-sec', 'GET', '/authorizations?status=approved');
  assert.equal(board.json().length, 1);
});

test('no se puede vincular el tratamiento de otro paciente', async () => {
  const { call } = setup({ extraTables: TABLES });
  const res = await call('tok-doc', 'POST', '/patients/p1/authorizations', { payer_id: 'os1', treatment_id: 'tx2', item: 'Algo indebido' });
  assert.equal(res.statusCode, 400);
});

test('financiadores: nombre duplicado y permisos', async () => {
  const { call } = setup({ extraTables: TABLES });
  assert.equal((await call('tok-doc', 'POST', '/payers', { name: 'Nueva' })).statusCode, 403);
  const created = await call('tok-sec', 'POST', '/payers', { name: '  Nueva Obra Social ', kind: 'obra_social' });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().name, 'Nueva Obra Social');
  const list = await call('tok-doc', 'GET', '/payers');
  assert.equal(list.json().length, 3);
});
