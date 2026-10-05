// Lectura de extractos bancarios o liquidaciones de obras sociales en CSV y
// emparejamiento con facturas pendientes. Pensado para formatos argentinos:
// separador ";" o ",", importes "1.234,56", fechas "dd/mm/aaaa".

// Mira las primeras líneas: los extractos suelen empezar con un título sin separadores.
export function detectDelimiter(text) {
  const sample = String(text).split(/\r?\n/).filter((line) => line.trim()).slice(0, 6);
  const counts = [';', ',', '\t'].map((d) => [d, Math.max(0, ...sample.map((line) => line.split(d).length - 1))]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

export function parseCsv(text, delimiter = detectDelimiter(text)) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text).replace(/^﻿/, '');

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(field.trim()); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

// "1.234,56" → 1234.56 · "1,234.56" → 1234.56 · "-500,00" · "$ 1.000" → 1000 · "(250,00)" → -250
export function parseAmount(raw) {
  if (raw == null) return null;
  let text = String(raw).trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text) || /-$/.test(text);
  text = text.replace(/[^\d.,]/g, '');
  if (!text) return null;

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let normalized;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    normalized = text.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma >= 0) {
    normalized = /,\d{1,2}$/.test(text) ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (lastDot >= 0) {
    // Un único punto seguido de 3 dígitos se toma como miles ("1.500" = 1500).
    const parts = text.split('.');
    normalized = parts.length > 2 || /\.\d{3}$/.test(text) ? parts.join('') : text;
  } else {
    normalized = text;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round((negative ? -value : value) * 100) / 100;
}

export function parseDate(raw) {
  const text = String(raw || '').trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  const month = match[2].padStart(2, '0');
  const day = match[1].padStart(2, '0');
  if (Number(month) > 12 || Number(day) > 31) return null;
  return `${year}-${month}-${day}`;
}

const strip = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function detectColumns(header) {
  const names = header.map(strip);
  const find = (pattern, exclude) => names.findIndex((name) => pattern.test(name) && !(exclude && exclude.test(name)));
  return {
    date: find(/fecha|date/),
    credit: find(/credito|haber|ingreso|acredit/),
    debit: find(/debito|debe|egreso/),
    amount: find(/importe|monto|amount|valor|total|neto/, /saldo/),
    description: find(/descrip|concepto|detalle|leyenda|movimiento/),
    reference: find(/referencia|comprobante|factura|n(ro|umero)|operacion/),
  };
}

// Convierte el CSV en movimientos { line_no, date, description, reference, amount }.
export function readStatement(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: 'El archivo no tiene filas de movimientos.' };

  const headerIndex = rows.findIndex((row) => {
    const cols = detectColumns(row);
    return cols.date >= 0 && (cols.amount >= 0 || cols.credit >= 0);
  });
  if (headerIndex < 0) {
    return { error: 'No encontré las columnas de fecha e importe. El CSV necesita encabezados como "Fecha" e "Importe" (o "Crédito").' };
  }

  const cols = detectColumns(rows[headerIndex]);
  const lines = [];
  rows.slice(headerIndex + 1).forEach((row, index) => {
    const date = parseDate(row[cols.date]);
    let amount = null;
    if (cols.credit >= 0 || cols.debit >= 0) {
      const credit = cols.credit >= 0 ? parseAmount(row[cols.credit]) : null;
      const debit = cols.debit >= 0 ? parseAmount(row[cols.debit]) : null;
      amount = credit ? Math.abs(credit) : debit ? -Math.abs(debit) : null;
    }
    if (amount === null && cols.amount >= 0) amount = parseAmount(row[cols.amount]);
    if (!date || amount === null) return;
    lines.push({
      line_no: headerIndex + index + 2,
      date,
      amount,
      description: cols.description >= 0 ? row[cols.description] || '' : '',
      reference: cols.reference >= 0 && cols.reference !== cols.description ? row[cols.reference] || '' : '',
    });
  });

  if (!lines.length) return { error: 'No se pudo leer ningún movimiento con fecha e importe válidos.' };
  return { lines, columns: cols };
}

const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

function score(line, record, payers) {
  if (Math.abs(Number(record.amount) - line.amount) > 0.009) return null;
  const text = strip(`${line.description} ${line.reference}`);
  const reasons = ['importe exacto'];
  let points = 1;

  const invoice = strip(record.invoice_number).replace(/[^a-z0-9]/g, '');
  const compact = text.replace(/[^a-z0-9]/g, '');
  if (invoice.length >= 3 && compact.includes(invoice)) {
    points += 5;
    reasons.push(`factura ${record.invoice_number} en el concepto`);
  }

  const payerName = strip(payers[record.payer_id]?.name || record.payer_name || '');
  if (payerName.length >= 4 && text.includes(payerName)) {
    points += 2;
    reasons.push('financiador en el concepto');
  }

  if (record.issued_at) {
    const gap = days(line.date, record.issued_at.slice(0, 10));
    if (gap < -3) return null; // cobro anterior a la emisión: no corresponde
    if (gap <= 120) {
      points += 1;
      reasons.push(`${gap} días después de la emisión`);
    }
  }
  return { points, reasons };
}

// Propone, para cada crédito, la factura pendiente que mejor corresponde.
// confident: una sola candidata con número de factura en el concepto, o una sola por importe.
export function matchStatement(lines, records, payers = {}) {
  const used = new Set();
  return lines.map((line) => {
    if (line.amount <= 0) return { ...line, status: 'ignored', reason: 'Débito o importe cero', candidates: [] };

    const candidates = records
      .filter((record) => !used.has(record.id))
      .map((record) => ({ record, ...score(line, record, payers) }))
      .filter((c) => c.points)
      .sort((a, b) => b.points - a.points);

    if (!candidates.length) return { ...line, status: 'unmatched', candidates: [] };

    const [best, second] = candidates;
    const clear = !second || best.points > second.points;
    const strong = best.points >= 6;
    const status = clear && (strong || candidates.length === 1) ? 'proposed' : 'review';
    if (status === 'proposed') used.add(best.record.id);

    return {
      ...line,
      status,
      candidates: candidates.slice(0, 5).map((c) => ({
        record_id: c.record.id,
        invoice_number: c.record.invoice_number,
        amount: Number(c.record.amount),
        patient_id: c.record.patient_id,
        issued_at: c.record.issued_at,
        points: c.points,
        reasons: c.reasons,
      })),
      proposed_record_id: status === 'proposed' ? best.record.id : null,
    };
  });
}
