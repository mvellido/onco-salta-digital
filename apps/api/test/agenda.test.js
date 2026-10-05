import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';
import { computeFreeSlots, findConflicts, isoWeekday, isWithinSchedule } from '../src/modules/secretary/service.js';

// 2026-10-12 es lunes.
const MONDAY = '2026-10-12';
const SCHEDULE = [{ id: 's1', professional_id: 'u-doc', weekday: 1, start_time: '09:00', end_time: '12:00', slot_minutes: 30, resource: null }];

function agenda(extra = {}) {
  return setup({
    extraTables: {
      professional_schedules: SCHEDULE,
      appointments: [
        { id: 'ap1', patient_id: 'p1', professional_id: 'u-doc', date: MONDAY, time: '09:00', duration_minutes: 60, kind: 'consulta', resource: null, status: 'scheduled' },
        { id: 'ap2', patient_id: 'p2', professional_id: 'u-doc2', date: MONDAY, time: '10:00', duration_minutes: 120, kind: 'quimioterapia', resource: 'Sillón 1', status: 'scheduled' },
      ],
      ...extra,
    },
  });
}

test('isoWeekday y superposición de intervalos', () => {
  assert.equal(isoWeekday(MONDAY), 1);
  assert.equal(isoWeekday('2026-10-18'), 7);
  const busy = [{ id: 'a', patient_id: 'x', professional_id: 'd', date: MONDAY, time: '09:00', duration_minutes: 60, status: 'scheduled' }];
  assert.equal(findConflicts(busy, { patient_id: 'y', professional_id: 'd', date: MONDAY, time: '09:30', duration_minutes: 30 }).professional.length, 1);
  assert.equal(findConflicts(busy, { patient_id: 'y', professional_id: 'd', date: MONDAY, time: '10:00', duration_minutes: 30 }).professional.length, 0, 'termina 10:00, empieza 10:00: no choca');
  assert.equal(isWithinSchedule(SCHEDULE, { date: MONDAY, time: '11:30', duration_minutes: 60 }), false);
});

test('turnos libres respetan horario y turnos tomados', () => {
  const slots = computeFreeSlots({
    schedules: SCHEDULE,
    appointments: [{ date: MONDAY, time: '09:00', duration_minutes: 60, status: 'scheduled' }, { date: MONDAY, time: '11:00', duration_minutes: 30, status: 'cancelled' }],
    date: MONDAY,
    duration: 30,
  });
  assert.deepEqual(slots, ['10:00', '10:30', '11:00', '11:30']);
});

test('el profesional por defecto es el médico asignado al paciente', async () => {
  const { call } = agenda();
  const res = await call('tok-sec', 'POST', '/appointments', { patient_id: 'p1', date: MONDAY, time: '11:00', kind: 'control' });
  assert.equal(res.statusCode, 201, res.body);
  assert.equal(res.json().professional_id, 'u-doc');
  assert.deepEqual(res.json().warnings, []);
});

test('choque con el profesional: 409, salvo sobreturno marcado', async () => {
  const { call, supabase } = agenda();
  const body = { patient_id: 'p2', professional_id: 'u-doc', date: MONDAY, time: '09:30', duration_minutes: 30 };
  const res = await call('tok-sec', 'POST', '/appointments', body);
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().details.code, 'professional_conflict');

  const forced = await call('tok-sec', 'POST', '/appointments', { ...body, overbook: true });
  assert.equal(forced.statusCode, 201);
  assert.equal(supabase.db.appointments.at(-1).is_overbook, true);
});

test('el mismo sillón no se puede usar dos veces a la vez, ni con sobreturno', async () => {
  const { call } = agenda();
  const res = await call('tok-sec', 'POST', '/appointments', { patient_id: 'p1', professional_id: 'u-doc', date: MONDAY, time: '11:00', duration_minutes: 60, kind: 'quimioterapia', resource: 'sillón 1', overbook: true });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().details.code, 'resource_conflict');
});

test('el paciente no puede tener dos turnos superpuestos', async () => {
  const { call } = agenda();
  const res = await call('tok-sec', 'POST', '/appointments', { patient_id: 'p1', professional_id: 'u-doc2', date: MONDAY, time: '09:15', overbook: true });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().details.code, 'patient_conflict');
});

test('fuera del horario de atención se guarda con advertencia', async () => {
  const { call } = agenda();
  const res = await call('tok-sec', 'POST', '/appointments', { patient_id: 'p1', date: MONDAY, time: '17:00' });
  assert.equal(res.statusCode, 201);
  assert.match(res.json().warnings[0], /fuera del horario/);
});

test('hora mal escrita se rechaza', async () => {
  const { call } = agenda();
  const res = await call('tok-sec', 'POST', '/appointments', { patient_id: 'p1', date: MONDAY, time: '9:00' });
  assert.equal(res.statusCode, 400);
});

test('un médico ve sus turnos como profesional aunque el paciente no sea suyo', async () => {
  const { call } = agenda({
    appointments: [{ id: 'ap3', patient_id: 'p2', professional_id: 'u-doc', date: MONDAY, time: '11:00', duration_minutes: 30, status: 'scheduled' }],
  });
  const res = await call('tok-doc', 'GET', `/appointments?from=${MONDAY}&to=${MONDAY}`);
  assert.deepEqual(res.json().map((a) => a.id), ['ap3']);
});

test('reprogramar revisa choques; cancelar no', async () => {
  const { call } = agenda();
  const moved = await call('tok-sec', 'PATCH', '/appointments/ap1', { time: '10:00', resource: 'Sillón 1' });
  assert.equal(moved.statusCode, 409);
  const cancelled = await call('tok-sec', 'PATCH', '/appointments/ap1', { status: 'cancelled' });
  assert.equal(cancelled.statusCode, 200);
});

test('horario: el médico edita el suyo, no el de otro', async () => {
  const { call } = agenda();
  const blocks = [{ weekday: 2, start_time: '14:00', end_time: '18:00', slot_minutes: 20 }];
  assert.equal((await call('tok-doc', 'PUT', '/professionals/u-doc2/schedule', { blocks })).statusCode, 403);
  const own = await call('tok-doc', 'PUT', '/professionals/u-doc/schedule', { blocks });
  assert.equal(own.statusCode, 200);
  assert.deepEqual(own.json().map((b) => b.weekday), [2]);
  assert.equal((await call('tok-doc', 'PUT', '/professionals/u-doc/schedule', { blocks: [{ weekday: 2, start_time: '18:00', end_time: '14:00' }] })).statusCode, 400);
});

test('turnos libres por API', async () => {
  const { call } = agenda();
  const res = await call('tok-sec', 'GET', `/agenda/free-slots?professional_id=u-doc&date=${MONDAY}&duration=60`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().slots, ['10:00', '10:30', '11:00']);
});

test('un turno rechazado por conflicto no se guarda', async () => {
  const { call, supabase } = agenda();
  const before = supabase.db.appointments.length;
  const res = await call('tok-sec', 'POST', '/appointments', { patient_id: 'p2', professional_id: 'u-doc', date: MONDAY, time: '09:30' });
  assert.equal(res.statusCode, 409);
  assert.equal(supabase.db.appointments.length, before);
});
