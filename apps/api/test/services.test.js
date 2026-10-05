import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAccessContext } from '../src/modules/shared/access.js';
import { validatePermissionUpdate, validateUserUpdate, groupRolePermissions } from '../src/modules/admin/service.js';
import { buildPatientInsertRow } from '../src/modules/patients/service.js';
import { hasScheduleConflict } from '../src/modules/secretary/service.js';
import { buildPatientContextBlock } from '../src/modules/ai/service.js';

test('un perfil inactivo no tiene permisos aunque su rol los tenga', () => {
  const ctx = buildAccessContext({ id: 'u1' }, { role: 'doctor', active: false }, ['patients:read']);
  assert.equal(ctx.can('patients:read'), false);
  assert.equal(ctx.role, null);
});

test('scope:all_patients habilita el alcance global', () => {
  const ctx = buildAccessContext({ id: 'u1' }, { role: 'secretary', active: true }, ['scope:all_patients']);
  assert.equal(ctx.allPatients, true);
});

test('validatePermissionUpdate rechaza roles y permisos desconocidos', () => {
  assert.match(validatePermissionUpdate({ role: 'root', permissions: [] }), /Rol desconocido/);
  assert.match(validatePermissionUpdate({ role: 'doctor', permissions: ['patients:delete'] }), /desconocidos/);
  assert.equal(validatePermissionUpdate({ role: 'doctor', permissions: ['patients:read'] }), null);
});

test('validateUserUpdate impide degradarse a uno mismo', () => {
  const ctx = { userId: 'u-admin', role: 'admin' };
  assert.ok(validateUserUpdate(ctx, 'u-admin', { role: 'doctor' }));
  assert.equal(validateUserUpdate(ctx, 'u-admin', { role: 'admin' }), null);
  assert.equal(validateUserUpdate(ctx, 'u-otro', { active: false }), null);
});

test('groupRolePermissions arma la matriz con todos los roles', () => {
  const map = groupRolePermissions([{ role: 'finance', permission: 'billing:read' }]);
  assert.deepEqual(map.finance, ['billing:read']);
  assert.deepEqual(map.admin, []);
});

test('buildPatientInsertRow usa las columnas de la migración', () => {
  const row = buildPatientInsertRow(
    { datos_generales: { nombre_completo: 'Ana', dni: '30111222', fecha_nacimiento: '1970-01-01', sexo: 'Femenino' } },
    'u-doc'
  );
  assert.deepEqual(
    Object.keys(row).sort(),
    ['assigned_doctor_id', 'birth_date', 'contact', 'diagnosis_summary', 'dni', 'full_name', 'gender']
  );
  assert.equal(row.assigned_doctor_id, 'u-doc');
});

test('hasScheduleConflict ignora turnos cancelados y el propio turno', () => {
  const turnos = [
    { id: 'a', patient_id: 'p1', date: '2026-10-10', time: '09:00', status: 'cancelled' },
    { id: 'b', patient_id: 'p1', date: '2026-10-10', time: '10:00', status: 'scheduled' },
  ];
  assert.equal(hasScheduleConflict(turnos, { patient_id: 'p1', date: '2026-10-10', time: '09:00' }), false);
  assert.equal(hasScheduleConflict(turnos, { patient_id: 'p1', date: '2026-10-10', time: '10:00' }), true);
  assert.equal(hasScheduleConflict(turnos, { patient_id: 'p1', date: '2026-10-10', time: '10:00' }, 'b'), false);
});

test('el contexto enviado a Gemini no incluye nombre ni DNI', () => {
  const block = buildPatientContextBlock({ full_name: 'Juana Ejemplo', dni: '30111222', diagnosis_summary: 'Adenocarcinoma' });
  assert.doesNotMatch(block, /Juana|30111222/);
  assert.match(block, /Adenocarcinoma/);
});
