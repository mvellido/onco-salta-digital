import { extractText, getDocumentProxy } from 'unpdf';

// Texto del PDF, una entrada por página (índice 0 = página 1).
export async function extractPdfPages(buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  return Array.isArray(text) ? text : [text];
}

const normalize = (value) => value.replace(/\s+/g, ' ').trim();

// Parte cada página en fragmentos de ~size caracteres con solapamiento, cortando
// preferentemente en fin de oración. Conserva el número de página para citar.
export function chunkPages(pages, { size = 1200, overlap = 200, minLength = 80 } = {}) {
  const chunks = [];
  pages.forEach((raw, index) => {
    const text = normalize(raw || '');
    if (text.length < minLength) return;

    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + size, text.length);
      if (end < text.length) {
        const sentenceEnd = text.lastIndexOf('. ', end);
        if (sentenceEnd > start + size * 0.5) end = sentenceEnd + 1;
      }
      const content = text.slice(start, end).trim();
      if (content.length >= minLength) {
        chunks.push({ page: index + 1, chunk_index: chunks.length, content });
      }
      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  });
  return chunks;
}

export function looksScanned(pages) {
  const total = pages.reduce((acc, page) => acc + normalize(page || '').length, 0);
  return total < 100 * Math.max(1, Math.min(pages.length, 3));
}
