import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';
import { detectDelimiter, matchStatement, parseAmount, parseDate, readStatement } from '../src/modules/billing/statement.js';

test('importes en formatos argentinos e internacionales', () => {
  assert.equal(parseAmount('1.234,56'), 1234.56);
  assert.equal(parseAmount('1,234.56'), 1234.56);
  assert.equal(parseAmount('$ 1.500'), 1500);
  assert.equal(parseAmount('250,5'), 250.5);
  assert.equal(parseAmount('(250,00)'), -250);
  assert.equal(parseAmount('-1.000,00'), -1000);
  assert.equal(parseAmount('12.5'), 12.5);
  assert.equal(parseAmount(''), null);
});

test('fechas dd/mm/aaaa, dd-mm-aa e ISO', () => {
  assert.equal(parseDate('05/10/2026'), '2026-10-05');
  assert.equal(parseDate('5-10-26'), '2026-10-05');
  assert.equal(parseDate('2026-10-05'), '2026-10-05');
  assert.equal(parseDate('31/13/2026'), null);
});

const BANK_CSV = [
  '﻿Extracto de cuenta corriente',
  'Fecha;Descripción;Referencia;Débito;Crédito;Saldo',
  '01/10/2026;"TRANSF RECIBIDA OBRA SOCIAL EJEMPLO FC A-0001-00000123";9911;;"125.000,00";"500.000,00"',
  '02/10/2026;COMISION MANTENIMIENTO;;"3.500,00";;"496.500,00"',
  '03/10/2026;TRANSFERENCIA RECIBIDA;7788;;"48.300,50";"544.800,50"',
  '04/10/2026;DEPOSITO EFECTIVO;;;"9.999,00";"554.799,50"',
].join('\r\n');

test('lee un extracto con columnas de débito y crédito separadas', () => {
  assert.equal(detectDelimiter('Fecha;Importe\n'), ';');
  const { lines, error } = readStatement(BANK_CSV);
  assert.equal(error, undefined);
  assert.equal(lines.length, 4);
  assert.deepEqual(lines.map((l) => l.amount), [125000, -3500, 48300.5, 9999]);
  assert.equal(lines[0].reference, '9911');
  assert.match(lines[0].description, /A-0001-00000123/);
});

test('un CSV sin columnas reconocibles da un error claro', () => {
  assert.match(readStatement('a;b\n1;2').error, /columnas de fecha e importe/);
});

const RECORDS = [
  { id: 'r1', patient_id: 'p1', invoice_number: 'A-0001-00000123', amount: 125000, status: 'pending', issued_at: '2026-09-15T00:00:00Z' },
  { id: 'r2', patient_id: 'p1', invoice_number: 'B-77', amount: 48300.5, status: 'pending', issued_at: '2026-09-20T00:00:00Z' },
  { id: 'r3', patient_id: 'p2', invoice_number: 'B-78', amount: 48300.5, status: 'overdue', issued_at: '2026-09-21T00:00:00Z' },
];

test('emparejamiento: número de factura seguro, importe repetido a revisar, débitos ignorados', () => {
  const { lines } = readStatement(BANK_CSV);
  const result = matchStatement(lines, RECORDS);
  assert.equal(result[0].status, 'proposed');
  assert.equal(result[0].proposed_record_id, 'r1');
  assert.match(result[0].candidates[0].reasons.join(' '), /factura A-0001-00000123/);
  assert.equal(result[1].status, 'ignored');
  assert.equal(result[2].status, 'review', 'dos facturas con el mismo importe: decide una persona');
  assert.equal(result[2].candidates.length, 2);
  assert.equal(result[3].status, 'unmatched');
});

test('un cobro anterior a la emisión de la factura no se propone', () => {
  const result = matchStatement([{ line_no: 1, date: '2026-09-01', amount: 125000, description: '', reference: '' }], RECORDS);
  assert.equal(result[0].status, 'unmatched');
});

test('importar, confirmar y dejar la factura pagada; el mismo archivo no se importa dos veces', async () => {
  const { call, supabase } = setup({ extraTables: { billing_records: RECORDS.map((r) => ({ ...r })), payers: [] } });

  const imported = await call('tok-fin', 'POST', '/billing/statements', { source_name: 'Banco - cuenta corriente', file_name: 'extracto.csv', csv_text: BANK_CSV });
  assert.equal(imported.statusCode, 201, imported.body);
  const { import: header, lines } = imported.json();
  assert.equal(header.line_count, 4);
  assert.equal(header.credit_total, 183299.5);

  const proposed = lines.find((l) => l.status === 'proposed');
  const review = lines.find((l) => l.status === 'review');

  const wrongAmount = await call('tok-fin', 'POST', `/billing/statements/${header.id}/confirm`, { matches: [{ line_id: proposed.id, record_id: 'r2' }] });
  assert.equal(wrongAmount.statusCode, 400);
  assert.match(wrongAmount.json().error, /no coincide/);

  const confirmed = await call('tok-fin', 'POST', `/billing/statements/${header.id}/confirm`, {
    matches: [{ line_id: proposed.id, record_id: 'r1' }, { line_id: review.id, record_id: 'r3' }],
  });
  assert.equal(confirmed.statusCode, 200, confirmed.body);
  const r1 = supabase.db.billing_records.find((r) => r.id === 'r1');
  assert.equal(r1.status, 'paid');
  assert.equal(r1.paid_at, '2026-10-01');
  assert.match(r1.payment_reference, /Banco - cuenta corriente/);
  assert.equal(supabase.db.billing_records.find((r) => r.id === 'r2').status, 'pending');
  assert.ok(supabase.db.audit_logs.some((l) => l.action === 'billing_payment_matched'));

  const again = await call('tok-fin', 'POST', `/billing/statements/${header.id}/confirm`, { matches: [{ line_id: proposed.id, record_id: 'r1' }] });
  assert.equal(again.statusCode, 400, 'no se concilia dos veces');

  const duplicate = await call('tok-fin', 'POST', '/billing/statements', { source_name: 'Banco', csv_text: BANK_CSV });
  assert.equal(duplicate.statusCode, 409);
});

test('quien solo ve facturación no puede importar ni confirmar', async () => {
  const { call } = setup();
  const res = await call('tok-doc', 'POST', '/billing/statements', { source_name: 'Banco', csv_text: BANK_CSV });
  assert.equal(res.statusCode, 403);
});
