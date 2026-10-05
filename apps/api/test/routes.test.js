import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';

test('sin token responde 401', async () => {
  const { call } = setup();
  const res = await call(null, 'GET', '/patients');
  assert.equal(res.statusCode, 401);
});

test('un usuario sin invitación (perfil inactivo) recibe 403', async () => {
  const { call } = setup();
  const res = await call('tok-nobody', 'GET', '/patients');
  assert.equal(res.statusCode, 403);
  assert.match(res.json().error, /no está habilitado/);
});

test('el médico ve solo sus pacientes, con datos clínicos', async () => {
  const { call } = setup();
  const res = await call('tok-doc', 'GET', '/patients');
  assert.equal(res.statusCode, 200);
  const patients = res.json();
  assert.deepEqual(patients.map((p) => p.id), ['p1']);
  assert.equal(patients[0].diagnosis_summary, 'Adenocarcinoma');
});

test('secretaría ve todos los pacientes pero sin diagnóstico', async () => {
  const { call } = setup();
  const res = await call('tok-sec', 'GET', '/patients');
  assert.equal(res.statusCode, 200);
  const patients = res.json();
  assert.equal(patients.length, 2);
  assert.ok(patients.every((p) => !('diagnosis_summary' in p) && !('molecular_markers' in p)));
});

test('secretaría no puede abrir la ficha clínica', async () => {
  const { call } = setup();
  const res = await call('tok-sec', 'GET', '/patients/p1');
  assert.equal(res.statusCode, 403);
});

test('un médico no puede abrir la ficha de un paciente ajeno', async () => {
  const { call } = setup();
  const res = await call('tok-doc', 'GET', '/patients/p2');
  assert.equal(res.statusCode, 404);
});

test('DELETE /patients/:id ya no borra', async () => {
  const { call, supabase } = setup();
  const res = await call('tok-doc', 'DELETE', '/patients/p1');
  assert.equal(res.statusCode, 405);
  assert.equal(supabase.db.patients.length, 2);
});

test('archivar exige motivo, conserva el registro y queda auditado', async () => {
  const { call, supabase } = setup();

  const sinMotivo = await call('tok-doc', 'POST', '/patients/p1/archive', {});
  assert.equal(sinMotivo.statusCode, 400);

  const res = await call('tok-doc', 'POST', '/patients/p1/archive', { reason: 'Derivado a otro centro' });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().archived_at);
  assert.equal(supabase.db.patients.length, 2);
  assert.ok(supabase.db.audit_logs.some((log) => log.action === 'patient_archive' && log.patient_id === 'p1'));

  const activos = await call('tok-doc', 'GET', '/patients');
  assert.deepEqual(activos.json(), []);
  const archivados = await call('tok-doc', 'GET', '/patients?archived=true');
  assert.deepEqual(archivados.json().map((p) => p.id), ['p1']);

  const restaurado = await call('tok-doc', 'POST', '/patients/p1/restore');
  assert.equal(restaurado.statusCode, 200);
  assert.equal(restaurado.json().archived_at, null);
});

test('editar no permite reasignar médico ni tocar campos de archivo', async () => {
  const { call, supabase } = setup();
  const res = await call('tok-doc', 'PUT', '/patients/p1', {
    status: 'follow_up',
    assigned_doctor_id: 'u-doc2',
    archived_at: '2026-01-01',
  });
  assert.equal(res.statusCode, 200);
  const row = supabase.db.patients.find((p) => p.id === 'p1');
  assert.equal(row.status, 'follow_up');
  assert.equal(row.assigned_doctor_id, 'u-doc');
  assert.equal(row.archived_at, null);
});

test('solo quien tiene users:manage edita permisos', async () => {
  const { call } = setup();
  const res = await call('tok-doc', 'PATCH', '/admin/permissions', { role: 'doctor', permissions: ['ai:use'] });
  assert.equal(res.statusCode, 403);
});

test('el admin no puede quitarle users:manage al rol admin', async () => {
  const { call } = setup();
  const res = await call('tok-admin', 'PATCH', '/admin/permissions', { role: 'admin', permissions: ['patients:read'] });
  assert.equal(res.statusCode, 400);
});

test('los permisos se guardan en la base, no en memoria', async () => {
  const { call, supabase } = setup();
  const res = await call('tok-admin', 'PATCH', '/admin/permissions', {
    role: 'secretary',
    permissions: ['patients:read_basic', 'appointments:read'],
  });
  assert.equal(res.statusCode, 200);
  const secretary = supabase.db.role_permissions.filter((r) => r.role === 'secretary').map((r) => r.permission).sort();
  assert.deepEqual(secretary, ['appointments:read', 'patients:read_basic']);
});

test('el admin no puede desactivarse a sí mismo', async () => {
  const { call } = setup();
  const res = await call('tok-admin', 'PATCH', '/admin/users/u-admin', { active: false });
  assert.equal(res.statusCode, 400);
});

test('/me devuelve rol y permisos para armar el menú', async () => {
  const { call } = setup();
  const res = await call('tok-sec', 'GET', '/me');
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().role, 'secretary');
  assert.ok(res.json().permissions.includes('appointments:write'));
});

test('los errores internos no exponen el mensaje de la base', async () => {
  const { app, supabase } = setup();
  const realFrom = supabase.from;
  supabase.from = (table) => {
    if (table === 'patients') throw new Error('relation "patients" does not exist');
    return realFrom(table);
  };
  const res = await app.inject({ method: 'GET', url: '/patients', headers: { authorization: 'Bearer tok-doc' } });
  assert.equal(res.statusCode, 500);
  assert.doesNotMatch(res.body, /relation/);
  assert.ok(res.json().requestId);
});
