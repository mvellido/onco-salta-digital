import { sendError, sendServerError, sendValidationError } from '../infra/errors.js';
import { validatePayload } from '../infra/validation.js';
import { GUIDELINES_BUCKET, processGuideline } from '../modules/guidelines/index.js';
import { GEMINI_MISSING_TEXT } from '../modules/ai/index.js';

const LIST_COLUMNS = 'id, title, organization, version, published_on, license_note, page_count, chunk_count, status, error, active, created_at, processed_at';

export default async function guidelinesRoutes(app, { supabase, authenticate, audit, gemini }) {
  async function findGuideline(id) {
    const { data, error } = await supabase.from('guidelines').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  // GET /guidelines - Biblioteca del centro
  app.get('/guidelines', async (request, reply) => {
    const ctx = await authenticate(request, reply, ['ai:use', 'guidelines:manage']);
    if (!ctx) return undefined;

    try {
      let query = supabase.from('guidelines').select(LIST_COLUMNS).order('created_at', { ascending: false });
      if (!ctx.can('guidelines:manage')) query = query.eq('active', true).eq('status', 'ready');
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /guidelines');
    }
  });

  // POST /guidelines - Registra una guía y devuelve la URL para subir el PDF
  app.post('/guidelines', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'guidelines:manage');
    if (!ctx) return undefined;

    const validation = validatePayload('guidelineCreate', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Datos de la guía inválidos', validation.errors);

    try {
      const { fileName, ...meta } = request.body;
      const safeName = fileName.replace(/[^\w.-]+/g, '-').toLowerCase();
      const id = crypto.randomUUID();
      const storagePath = `${id}/${safeName}`;

      const { data: guideline, error } = await supabase
        .from('guidelines')
        .insert([{ id, ...meta, storage_path: storagePath, uploaded_by: ctx.userId }])
        .select(LIST_COLUMNS)
        .single();
      if (error) throw error;

      const { data: signedUpload, error: signError } = await supabase.storage.from(GUIDELINES_BUCKET).createSignedUploadUrl(storagePath);
      if (signError) throw signError;

      await audit({ actorId: ctx.userId, resourceType: 'guideline', resourceId: id, action: 'guideline_create', details: { title: meta.title } });

      return reply.code(201).send({ guideline, bucket: GUIDELINES_BUCKET, path: storagePath, signedUpload });
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in POST /guidelines');
    }
  });

  // POST /guidelines/:id/process - Extrae texto, fragmenta y vectoriza
  app.post('/guidelines/:id/process', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'guidelines:manage');
    if (!ctx) return undefined;
    if (!gemini) return sendError(reply, 503, GEMINI_MISSING_TEXT);

    let guideline;
    try {
      guideline = await findGuideline(request.params.id);
      if (!guideline) return sendError(reply, 404, 'Guía no encontrada');
      await supabase.from('guidelines').update({ status: 'processing', error: null }).eq('id', guideline.id);

      const { pageCount, chunkCount } = await processGuideline({ supabase, gemini, guideline });
      const { data, error } = await supabase
        .from('guidelines')
        .update({ status: 'ready', page_count: pageCount, chunk_count: chunkCount, processed_at: new Date().toISOString() })
        .eq('id', guideline.id)
        .select(LIST_COLUMNS)
        .single();
      if (error) throw error;

      await audit({ actorId: ctx.userId, resourceType: 'guideline', resourceId: guideline.id, action: 'guideline_process', details: { pages: pageCount, chunks: chunkCount } });
      return data;
    } catch (err) {
      const message = err.userFacing ? err.message : 'No se pudo procesar el PDF. Revisá que sea un PDF válido y volvé a intentar.';
      if (guideline) await supabase.from('guidelines').update({ status: 'failed', error: message }).eq('id', guideline.id);
      if (err.userFacing) return sendError(reply, 422, message);
      return sendServerError(request, reply, err, 'Exception in POST /guidelines/:id/process');
    }
  });

  // PATCH /guidelines/:id - Activar, desactivar o corregir datos
  app.patch('/guidelines/:id', async (request, reply) => {
    const ctx = await authenticate(request, reply, 'guidelines:manage');
    if (!ctx) return undefined;

    const validation = validatePayload('guidelineUpdate', request.body);
    if (!validation.ok) return sendValidationError(reply, 'Cambio inválido', validation.errors);

    try {
      const { data, error } = await supabase.from('guidelines').update(request.body).eq('id', request.params.id).select(LIST_COLUMNS).maybeSingle();
      if (error) throw error;
      if (!data) return sendError(reply, 404, 'Guía no encontrada');
      await audit({ actorId: ctx.userId, resourceType: 'guideline', resourceId: data.id, action: 'guideline_update', details: request.body });
      return data;
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in PATCH /guidelines/:id');
    }
  });

  // GET /guidelines/:id/url?page=N - Enlace temporal al PDF, abierto en la página citada
  app.get('/guidelines/:id/url', async (request, reply) => {
    const ctx = await authenticate(request, reply, ['ai:use', 'guidelines:manage']);
    if (!ctx) return undefined;

    try {
      const guideline = await findGuideline(request.params.id);
      if (!guideline) return sendError(reply, 404, 'Guía no encontrada');

      const { data, error } = await supabase.storage.from(GUIDELINES_BUCKET).createSignedUrl(guideline.storage_path, 600);
      if (error) throw error;

      const page = Number.parseInt(request.query?.page, 10);
      return { url: `${data.signedUrl}${Number.isInteger(page) && page > 0 ? `#page=${page}` : ''}`, title: guideline.title };
    } catch (err) {
      return sendServerError(request, reply, err, 'Exception in GET /guidelines/:id/url');
    }
  });
}
