import { chunkPages, extractPdfPages, looksScanned } from './text.js';

export const GUIDELINES_BUCKET = 'guidelines';

async function downloadBuffer(supabase, bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

// Descarga, extrae, fragmenta y vectoriza una guía. Reemplaza los fragmentos previos.
export async function processGuideline({ supabase, gemini, guideline }) {
  const buffer = await downloadBuffer(supabase, GUIDELINES_BUCKET, guideline.storage_path);
  const pages = await extractPdfPages(buffer);

  if (looksScanned(pages)) {
    const error = new Error('El PDF no tiene texto seleccionable (parece escaneado). Subí una versión digital de la guía.');
    error.userFacing = true;
    throw error;
  }

  const chunks = chunkPages(pages);
  const vectors = await gemini.embedDocuments(chunks.map((chunk) => chunk.content));

  const { error: deleteError } = await supabase.from('guideline_chunks').delete().eq('guideline_id', guideline.id);
  if (deleteError) throw deleteError;

  for (let i = 0; i < chunks.length; i += 200) {
    const rows = chunks.slice(i, i + 200).map((chunk, j) => ({
      guideline_id: guideline.id,
      page: chunk.page,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      embedding: JSON.stringify(vectors[i + j]),
    }));
    const { error } = await supabase.from('guideline_chunks').insert(rows);
    if (error) throw error;
  }

  return { pageCount: pages.length, chunkCount: chunks.length };
}

// Busca fragmentos de guías relevantes para la consulta. Sin guías cargadas
// devuelve una lista vacía (la respuesta lo aclara).
export async function retrieveGuidance({ supabase, gemini, query, matchCount = 6, minSimilarity = 0.55 }) {
  const embedding = await gemini.embedQuery(query);
  const { data, error } = await supabase.rpc('match_guideline_chunks', {
    query_embedding: JSON.stringify(embedding),
    match_count: matchCount,
    min_similarity: minSimilarity,
  });
  if (error) throw error;

  return (data || []).map((row, index) => ({
    n: index + 1,
    guideline_id: row.guideline_id,
    title: row.title,
    organization: row.organization,
    version: row.version,
    page: row.page,
    excerpt: row.content,
    similarity: Number(row.similarity),
  }));
}

export function formatSourcesForPrompt(sources) {
  if (!sources.length) {
    return 'No hay fragmentos de guías relevantes en la biblioteca del centro para esta consulta.';
  }
  return sources
    .map((s) => `[${s.n}] ${s.title}${s.organization ? ` (${s.organization}${s.version ? ` ${s.version}` : ''})` : ''}, pág. ${s.page}:\n"""${s.excerpt}"""`)
    .join('\n\n');
}

// Devuelve solo las fuentes que la respuesta realmente cita con [n].
export function citedSources(answer, sources) {
  const cited = new Set([...String(answer || '').matchAll(/\[(\d{1,2})\]/g)].map((match) => Number(match[1])));
  return sources.filter((source) => cited.has(source.n));
}

export function buildRetrievalQuery({ question, patient }) {
  const tumors = (patient.tumors || [])
    .map((t) => [t.histology, t.primary_site, t.stage_group && `estadio ${t.stage_group}`, ...(t.biomarkers || []).map((b) => `${b.name} ${b.result}`)].filter(Boolean).join(' '))
    .join('; ');
  return [question, patient.diagnosis_summary, tumors].filter(Boolean).join('\n').slice(0, 2000);
}
