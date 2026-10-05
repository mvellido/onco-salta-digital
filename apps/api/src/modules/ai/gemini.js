import { GoogleGenerativeAI } from '@google/generative-ai';

export const DEFAULT_MODEL = 'gemini-3.8-flash';
export const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-2';
export const EMBEDDING_DIMENSIONS = 768;
const EMBED_BATCH = 100;

// Cliente de Gemini con la superficie mínima que usa la API. Devuelve null si
// no hay clave: las rutas responden con un aviso en lugar de fallar.
export function createGemini({ apiKey, model = DEFAULT_MODEL, embeddingModel = DEFAULT_EMBEDDING_MODEL }) {
  if (!apiKey) return null;

  const client = new GoogleGenerativeAI(apiKey);
  const generator = (json) => client.getGenerativeModel({
    model,
    generationConfig: json ? { responseMimeType: 'application/json', temperature: 0.1 } : { temperature: 0.3 },
  });
  const embedder = client.getGenerativeModel({ model: embeddingModel });

  return {
    model,
    embeddingModel,

    // parts: partes extra (por ejemplo, un archivo en base64) después del texto.
    async generate(prompt, { json = false, parts = [] } = {}) {
      const result = await generator(json).generateContent([{ text: prompt }, ...parts]);
      return result.response.text();
    },

    async embedQuery(text) {
      const result = await embedder.embedContent({
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: EMBEDDING_DIMENSIONS,
      });
      return result.embedding.values;
    },

    async embedDocuments(texts) {
      const vectors = [];
      for (let i = 0; i < texts.length; i += EMBED_BATCH) {
        const batch = texts.slice(i, i + EMBED_BATCH);
        const result = await embedder.batchEmbedContents({
          requests: batch.map((text) => ({
            content: { parts: [{ text }] },
            taskType: 'RETRIEVAL_DOCUMENT',
            outputDimensionality: EMBEDDING_DIMENSIONS,
          })),
        });
        vectors.push(...result.embeddings.map((embedding) => embedding.values));
      }
      return vectors;
    },
  };
}

export const GEMINI_MISSING_TEXT = 'No se pudo consultar Gemini: GEMINI_API_KEY no está configurada en el servidor.';

// Extrae el primer objeto JSON de una respuesta (tolera ```json ... ```).
export function parseJsonResponse(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
