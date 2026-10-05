import { createHash } from 'node:crypto';
import { sendError, sendServerError, sendValidationError } from '../infra/errors.js';
import { validatePayload } from '../infra/validation.js';
import { getAccessiblePatientIds } from '../modules/shared/access.js';
import { listBillingRecords, readStatement, matchStatement } from '../modules/billing/index.js';

const MAX_CSV_BYTES = 3 * 1024 * 1024;

// Conciliación contra extractos bancarios o liquidaciones de obras sociales.
export default async function statementsRoutes(app, { supabase, authenticate, audit }) {
  async function loadImport(id) {
    const { data, error } = await supabase.from('statement_imports').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function loadLines(importId) {
    const { data, error } = await supabase.from('statement_lines').select('*').eq('import_id', importId).order('line_no', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // POST /billing/statements - Importa un CSV y propone emparejamientos
  app.post('/billing/statements', { bodyLimit: MAX_CSV_BYTES + 64 * 1024 }, async (request, reply) => {
    const ctx = await authenticate(request, reply, 'billing:write');
    if (!ctx) return undefined;

    const validation = validatePayload('statementImport', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Datos del extracto inválidos', validation.errors);
    const { source_name: sourceName, payer_id: payerId = null, file_name: fileName = null, csv_text: csvText } = request.body;
    if (Buffer.byteLength(csvText) > MAX_CSV_BYTES) return sendError(reply, 413, 'El archivo supera los 3 MB.');

    const parsed = readStatement(csvText);
    if (parsed.error) return sendError(reply, 422, parsed.error);

    try {
      const contentHash = createHash('sha256').update(csvText).digest('hex');
      const { data: existing, error: existingError } = await supabase.from('statement_imports').select('id').eq('content_hash', contentHash).maybeSingle();
      if (existingError) throw existingError;
      if (existing) return sendError(reply, 409, 'Este archivo ya se importó.', { import_id: existing.id });

      const patientIds = await getAccessiblePatientIds(supabase, ctx);
      const records = (await listBillingRecords(supabase, patientIds)).filter((r) => r.status === 'pending' || r.status === 'overdue');
      const { data: payerRows, error: payerError } = await supabase.from('payers').select('id, name');
      if (payerError) throw payerError;
      const payers = Object.fromEntries((payerRows || []).map((p) => [p.id, p]));

      const matched = matchStatement(parsed.lines, records, payers);
      const creditTotal = parsed.lines.filter((l) => l.amount > 0).reduce((acc, l) => acc + l.amount, 0);

      const { data: imported, error: importError } = await supabase
        .from('statement_imports')
        .insert([{
          source_name: sourceName.trim(),
          payer_id: payerId,
          file_name: fileName,
          content_hash: contentHash,
          line_count: parsed.lines.length,
          credit_total: Math.round(creditTotal * 100) / 100,
          imported_by: ctx.userId,
        }])
        .select()
        .single();
      if (importError) throw importError;

      const { error: linesError } = await supabase.from('statement_lines').insert(matched.map((line) => ({
        import_id: imported.id,
        line_no: line.line_no,
        date: line.date,
        description: line.description,
        reference: line.reference,
        amount: line.amount,
        status: line.status,
        candidates: line.candidates,
      })));
      if (linesError) throw linesError;

      await audit({
        actorId: ctx.userId,
        resourceType: 'statement',
        resourceId: imported.id,
        action: 'billing_statement_import',
        details: { lines: parsed.lines.length, proposed: matched.filter((l) => l.status === 'proposed').length },
      });

      return reply.code(201).send({ import: imported, lines: await loadLines(imported.id) });
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /billing/statements');
    }
  });

  // GET /billing/statements - Extractos importados
  app.get('/billing/statements', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'billing:read');
    if (!ctx) return undefined;
    try {
      const { data, error } = await supabase.from('statement_imports').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /billing/statements');
    }
  });

  // GET /billing/statements/:id - Extracto con sus movimientos
  app.get('/billing/statements/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'billing:read');
    if (!ctx) return undefined;
    try {
      const imported = await loadImport(request.params.id);
      if (!imported) return sendError(reply, 404, 'Extracto no encontrado');
      return { import: imported, lines: await loadLines(imported.id) };
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /billing/statements/:id');
    }
  });

  // POST /billing/statements/:id/confirm - Confirma emparejamientos: la factura queda pagada
  app.post('/billing/statements/:id/confirm', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'billing:write');
    if (!ctx) return undefined;

    const validation = validatePayload('statementConfirm', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Emparejamientos inválidos', validation.errors);

    try {
      const imported = await loadImport(request.params.id);
      if (!imported) return sendError(reply, 404, 'Extracto no encontrado');

      const lines = Object.fromEntries((await loadLines(imported.id)).map((l) => [l.id, l]));
      const patientIds = await getAccessiblePatientIds(supabase, ctx);
      const records = Object.fromEntries((await listBillingRecords(supabase, patientIds)).map((r) => [r.id, r]));
      const { matches } = request.body;

      if (new Set(matches.map((m) => m.record_id)).size !== matches.length) return sendError(reply, 400, 'Una factura no puede emparejarse con dos movimientos.');
      if (new Set(matches.map((m) => m.line_id)).size !== matches.length) return sendError(reply, 400, 'Un movimiento no puede emparejarse con dos facturas.');

      const problems = [];
      for (const { line_id: lineId, record_id: recordId } of matches) {
        const line = lines[lineId];
        const record = records[recordId];
        if (!line) problems.push('Un movimiento no pertenece a este extracto.');
        else if (line.status === 'matched') problems.push(`El movimiento de la fila ${line.line_no} ya está conciliado.`);
        else if (!record) problems.push('Una factura no existe o no está a tu alcance.');
        else if (!['pending', 'overdue'].includes(record.status)) problems.push(`La factura ${record.invoice_number} ya no está pendiente.`);
        else if (Math.abs(Number(record.amount) - Number(line.amount)) > 0.009) problems.push(`El importe de la factura ${record.invoice_number} no coincide con la fila ${line.line_no}.`);
      }
      if (problems.length) return sendError(reply, 400, problems[0], { problems });

      for (const { line_id: lineId, record_id: recordId } of matches) {
        const line = lines[lineId];
        const reference = [imported.source_name, line.reference || line.description].filter(Boolean).join(' · ').slice(0, 200);
        const { error: recordError } = await supabase.from('billing_records').update({ status: 'paid', paid_at: line.date, payment_reference: reference }).eq('id', recordId);
        if (recordError) throw recordError;
        const { error: lineError } = await supabase.from('statement_lines').update({ status: 'matched', matched_record_id: recordId, matched_by: ctx.userId, matched_at: new Date().toISOString() }).eq('id', lineId);
        if (lineError) throw lineError;
        await audit({
          actorId: ctx.userId,
          patientId: records[recordId].patient_id,
          resourceType: 'billing_record',
          resourceId: recordId,
          action: 'billing_payment_matched',
          details: { import_id: imported.id, line_no: line.line_no, amount: line.amount },
        });
      }

      return { confirmed: matches.length, lines: await loadLines(imported.id) };
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /billing/statements/:id/confirm');
    }
  });

  // POST /billing/statements/:id/lines/:lineId/ignore - Movimiento ajeno a facturas
  app.post('/billing/statements/:id/lines/:lineId/ignore', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'billing:write');
    if (!ctx) return undefined;
    try {
      const { data, error } = await supabase
        .from('statement_lines')
        .update({ status: 'ignored' })
        .eq('id', request.params.lineId)
        .eq('import_id', request.params.id)
        .neq('status', 'matched')
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) return sendError(reply, 404, 'Movimiento no encontrado o ya conciliado');
      return data;
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /billing/statements/:id/lines/:lineId/ignore');
    }
  });
}
