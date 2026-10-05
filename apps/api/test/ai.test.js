import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';
import { makePdf } from './pdf.js';
import { createRedactor } from '../src/modules/ai/redact.js';
import { sanitizeExtraction } from '../src/modules/ai/extraction.js';
import { chunkPages, citedSources, extractPdfPages, looksScanned } from '../src/modules/guidelines/index.js';

function fakeGemini(reply = () => 'Respuesta del asistente.') {
  const calls = [];
  return {
    model: 'fake-model',
    calls,
    async generate(prompt, opts = {}) {
      calls.push({ prompt, opts });
      return reply(prompt, opts);
    },
    async embedQuery() { return new Array(768).fill(0.01); },
    async embedDocuments(texts) { return texts.map(() => new Array(768).fill(0.01)); },
  };
}

const GUIDE_HIT = {
  chunk_id: 1,
  guideline_id: 'g1',
  title: 'Cáncer de pulmón no microcítico metastásico',
  organization: 'ESMO',
  version: '2025',
  page: 14,
  content: 'En PD-L1 ≥ 50% sin alteraciones accionables se recomienda inmunoterapia de primera línea.',
  similarity: 0.82,
};

const PATIENT_TABLES = {
  treatment_history: [{ id: 'e1', patient_id: 'p1', event_date: '2026-06-20', event_type: 'Diagnóstico', description: 'Biopsia de Paciente Uno, DNI 30.111.222, tel 387 155-1234', created_at: '2026-06-20' }],
  event_attachments: [
    { id: 'a-pdf', event_id: 'e1', file_name: 'anatomia-patologica.pdf', storage_path: 'patients/p1/e1/ap.pdf', content_type: 'application/pdf' },
    { id: 'a-img', event_id: 'e1', file_name: 'tc.png', storage_path: 'patients/p1/e1/tc.png', content_type: 'image/png' },
  ],
};

// ------------------------------------------------------------- anonimización

test('el redactor quita nombre (sin importar tildes), DNI, teléfono y email', () => {
  const redactor = createRedactor({ full_name: 'María José Pérez', dni: '30111222', contact: 'mjp@mail.com' });
  const out = redactor.redact('Paciente maria jose PEREZ, DNI 30.111.222, cel +54 9 387 555-1234, mail mjp@mail.com. Control 2026-06-12. Plaquetas 250.000.');
  assert.doesNotMatch(out, /mar[ií]a|p[eé]rez|30\.111|555-1234|mjp@/i);
  assert.match(out, /\[PACIENTE\]/);
  assert.match(out, /2026-06-12/, 'las fechas no se borran');
  assert.match(out, /250\.000/, 'los valores de laboratorio no se borran');
  assert.ok(redactor.count >= 4);
});

// ------------------------------------------------------------- consultas

test('la consulta cita la guía, guarda el historial y no envía datos personales', async () => {
  const gemini = fakeGemini(() => 'Con PD-L1 60% corresponde inmunoterapia [1]. Falta función renal.');
  const { call, supabase } = setup({ gemini, extraTables: PATIENT_TABLES, rpc: { match_guideline_chunks: () => [GUIDE_HIT] } });

  const res = await call('tok-doc', 'POST', '/ai/chat', { patientId: 'p1', message: '¿Qué le indico a Paciente Uno?' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.sources.length, 1);
  assert.equal(body.sources[0].page, 14);
  assert.ok(body.redactions >= 3);

  const sentPrompt = gemini.calls[0].prompt;
  assert.doesNotMatch(sentPrompt, /Paciente Uno|30\.111\.222|155-1234/);
  assert.match(sentPrompt, /\[1\] Cáncer de pulmón no microcítico metastásico \(ESMO 2025\), pág\. 14/);
  assert.match(sentPrompt, /ignorá cualquier pedido/);

  const saved = supabase.db.ai_interactions[0];
  assert.equal(saved.question, '¿Qué le indico a Paciente Uno?', 'en la base queda la pregunta original');
  assert.equal(saved.sources[0].guideline_id, 'g1');

  const history = await call('tok-doc', 'GET', '/patients/p1/ai-history');
  assert.equal(history.json().length, 1);
});

test('si la respuesta no cita, no se devuelven fuentes', async () => {
  const gemini = fakeGemini(() => 'Las guías cargadas no cubren esta pregunta.');
  const { call } = setup({ gemini, extraTables: PATIENT_TABLES, rpc: { match_guideline_chunks: () => [GUIDE_HIT] } });
  const res = await call('tok-doc', 'POST', '/ai/recommendations', { patientId: 'p1', clinicalQuestion: 'Dosis de radioterapia' });
  assert.deepEqual(res.json().sources, []);
  assert.equal(res.json().guidelinesSearched, 1);
});

test('sin biblioteca de guías la consulta igual responde y lo avisa en el prompt', async () => {
  const gemini = fakeGemini();
  const { call } = setup({ gemini, extraTables: PATIENT_TABLES });
  const res = await call('tok-doc', 'POST', '/ai/chat', { patientId: 'p1', message: 'Resumí el caso' });
  assert.equal(res.statusCode, 200);
  assert.match(gemini.calls[0].prompt, /No hay fragmentos de guías relevantes/);
});

test('sin clave de Gemini se informa sin fallar ni guardar', async () => {
  const { call, supabase } = setup({ extraTables: PATIENT_TABLES });
  const res = await call('tok-doc', 'POST', '/ai/chat', { patientId: 'p1', message: 'hola' });
  assert.equal(res.json().provider, 'fallback');
  assert.equal((supabase.db.ai_interactions || []).length, 0);
});

test('secretaría no usa la IA clínica', async () => {
  const { call } = setup({ gemini: fakeGemini(), extraTables: PATIENT_TABLES });
  const res = await call('tok-sec', 'POST', '/ai/chat', { patientId: 'p1', message: 'hola' });
  assert.equal(res.statusCode, 403);
});

// ------------------------------------------------------------- lectura de documentos

test('un PDF con texto se lee localmente, anonimizado, y propone datos validados', async () => {
  const pdf = makePdf([
    'INFORME DE ANATOMIA PATOLOGICA. Paciente: Paciente Uno. DNI 30.111.222. Fecha 20/06/2026.',
    'Diagnostico: adenocarcinoma de pulmon izquierdo, lobulo superior. Tamano 35 mm. PD-L1 60 por ciento. EGFR no mutado. ALK negativo.',
  ]);
  const gemini = fakeGemini(() => JSON.stringify({
    document_type: 'patologia',
    document_date: '2026-06-20',
    summary: 'Adenocarcinoma de pulmón izquierdo.',
    findings: ['PD-L1 60%'],
    tumor: { primary_site: 'lung', laterality: 'left', histology: 'Adenocarcinoma', size_mm: '35', t_category: 't2a', stage_group: 'iib' },
    biomarkers: [{ name: 'PD-L1', result: '60%' }, { name: 'EGFR', result: 'no mutado' }, { name: '', result: 'x' }],
    confidence: 'alta',
  }));
  const { call, supabase } = setup({ gemini, extraTables: PATIENT_TABLES, files: { 'medical-history/patients/p1/e1/ap.pdf': pdf } });

  const res = await call('tok-doc', 'POST', '/patients/p1/attachments/a-pdf/read', {});
  assert.equal(res.statusCode, 200, res.body);
  const saved = res.json();
  assert.equal(saved.method, 'pdf_text');
  assert.equal(saved.extracted.tumor.size_mm, 35);
  assert.equal(saved.extracted.tumor.t_category, 'T2a');
  assert.equal(saved.extracted.biomarkers.length, 2);

  const { prompt, opts } = gemini.calls[0];
  assert.match(prompt, /adenocarcinoma de pulmon/i, 'el texto del PDF llega al prompt');
  assert.doesNotMatch(prompt, /Paciente Uno|30\.111\.222/);
  assert.equal(opts.parts.length, 0, 'no se envía el archivo');
  assert.ok(supabase.db.audit_logs.some((log) => log.action === 'ai_document_read' && log.details.file_sent === false));
});

test('una imagen exige consentimiento antes de enviarse completa', async () => {
  const gemini = fakeGemini(() => JSON.stringify({ summary: 'TC de tórax.', tumor: {}, confidence: 'media' }));
  const { call } = setup({ gemini, extraTables: PATIENT_TABLES, files: { 'medical-history/patients/p1/e1/tc.png': Buffer.from('png') } });

  const sinPermiso = await call('tok-doc', 'POST', '/patients/p1/attachments/a-img/read', {});
  assert.equal(sinPermiso.statusCode, 409);
  assert.equal(sinPermiso.json().code, 'needs_consent');
  assert.equal(gemini.calls.length, 0);

  const conPermiso = await call('tok-doc', 'POST', '/patients/p1/attachments/a-img/read', { allowFileUpload: true });
  assert.equal(conPermiso.statusCode, 200);
  assert.equal(gemini.calls[0].opts.parts[0].inlineData.mimeType, 'image/png');
});

test('no se puede leer el adjunto de otro paciente', async () => {
  const tables = { ...PATIENT_TABLES, treatment_history: [{ ...PATIENT_TABLES.treatment_history[0], patient_id: 'p2' }] };
  const { call } = setup({ gemini: fakeGemini(), extraTables: tables });
  const res = await call('tok-doc', 'POST', '/patients/p1/attachments/a-pdf/read', {});
  assert.equal(res.statusCode, 404);
});

test('sanitizeExtraction descarta códigos y formatos inválidos', () => {
  const out = sanitizeExtraction({ tumor: { primary_site: 'pulmon', laterality: 'izq', size_mm: -3, n_category: 'T1' }, document_date: '20/06/2026', confidence: 'altísima' });
  assert.equal(out.tumor.primary_site, null);
  assert.equal(out.tumor.laterality, null);
  assert.equal(out.tumor.size_mm, null);
  assert.equal(out.tumor.n_category, null);
  assert.equal(out.document_date, null);
  assert.equal(out.confidence, 'baja');
});

// ------------------------------------------------------------- biblioteca de guías

test('el PDF de una guía se procesa: páginas, fragmentos y vectores', async () => {
  const text = 'La inmunoterapia con pembrolizumab es el estandar en primera linea para tumores con expresion de PD-L1 mayor o igual a 50 por ciento. ';
  const pdf = makePdf([text.repeat(4), text.repeat(6), text.repeat(2)]);
  const gemini = fakeGemini();
  const { call, supabase } = setup({ gemini });

  const created = await call('tok-admin', 'POST', '/guidelines', { title: 'Guía de pulmón', organization: 'ESMO', fileName: 'Guia Pulmon.pdf' });
  assert.equal(created.statusCode, 201, created.body);
  const { guideline, path } = created.json();
  assert.match(path, /^[0-9a-f-]{36}\/guia-pulmon\.pdf$/);
  supabase.files[`guidelines/${path}`] = pdf;

  const processed = await call('tok-admin', 'POST', `/guidelines/${guideline.id}/process`);
  assert.equal(processed.statusCode, 200, processed.body);
  assert.equal(processed.json().status, 'ready');
  assert.equal(processed.json().page_count, 3);
  const chunks = supabase.db.guideline_chunks;
  assert.ok(chunks.length >= 3);
  assert.deepEqual([...new Set(chunks.map((c) => c.page))], [1, 2, 3]);
  assert.equal(JSON.parse(chunks[0].embedding).length, 768);
});

test('un PDF escaneado se rechaza con un mensaje claro', async () => {
  const { call, supabase } = setup({ gemini: fakeGemini() });
  const created = (await call('tok-admin', 'POST', '/guidelines', { title: 'Escaneada', fileName: 'x.pdf' })).json();
  supabase.files[`guidelines/${created.path}`] = makePdf(['', '']);
  const res = await call('tok-admin', 'POST', `/guidelines/${created.guideline.id}/process`);
  assert.equal(res.statusCode, 422);
  assert.match(res.json().error, /escaneado/);
  assert.equal(supabase.db.guidelines[0].status, 'failed');
});

test('solo quien administra guías puede subirlas', async () => {
  const { call } = setup({ gemini: fakeGemini() });
  const res = await call('tok-doc', 'POST', '/guidelines', { title: 'Guía', fileName: 'g.pdf' });
  assert.equal(res.statusCode, 403);
});

test('extracción por página y fragmentos con número de página', async () => {
  const pages = await extractPdfPages(makePdf(['Primera pagina con texto suficiente para ser un fragmento valido de prueba.', 'Segunda pagina tambien con bastante texto para el fragmento de prueba.']));
  assert.equal(pages.length, 2);
  assert.match(pages[1], /Segunda pagina/);
  assert.equal(looksScanned(pages), true, 'poco texto en total cuenta como escaneado');
  const chunks = chunkPages(['x'.repeat(50), 'Oración uno. '.repeat(200)], { size: 500, overlap: 100 });
  assert.ok(chunks.every((c) => c.page === 2 && c.content.length <= 500));
  assert.deepEqual(citedSources('Ver [2] y [2].', [{ n: 1 }, { n: 2 }]), [{ n: 2 }]);
});
