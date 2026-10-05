import { PRIMARY_SITES, LATERALITIES } from '../clinical/catalog.js';

const DOCUMENT_TYPES = ['patologia', 'imagenes', 'laboratorio', 'epicrisis', 'otro'];
const CONFIDENCE = ['alta', 'media', 'baja'];

const str = (value, max = 200) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);
const tnm = (value, letter) => {
  const text = str(value, 10);
  return text && text.toUpperCase().startsWith(letter) ? text.charAt(0).toUpperCase() + text.slice(1) : null;
};

// Valida y recorta lo que devolvió el modelo antes de guardarlo o proponerlo.
// Lo que no cumple el formato se descarta (null), nunca se adivina.
export function sanitizeExtraction(raw = {}) {
  const tumor = raw.tumor && typeof raw.tumor === 'object' ? raw.tumor : {};
  const size = Number.parseInt(tumor.size_mm, 10);
  const date = str(raw.document_date, 10);

  return {
    document_type: DOCUMENT_TYPES.includes(raw.document_type) ? raw.document_type : 'otro',
    document_date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    summary: str(raw.summary, 2000) || 'Sin resumen.',
    findings: (Array.isArray(raw.findings) ? raw.findings : []).map((f) => str(f, 300)).filter(Boolean).slice(0, 15),
    tumor: {
      primary_site: PRIMARY_SITES.includes(tumor.primary_site) ? tumor.primary_site : null,
      laterality: LATERALITIES.includes(tumor.laterality) ? tumor.laterality : null,
      histology: str(tumor.histology),
      size_mm: Number.isInteger(size) && size > 0 && size < 1000 ? size : null,
      t_category: tnm(tumor.t_category, 'T'),
      n_category: tnm(tumor.n_category, 'N'),
      m_category: tnm(tumor.m_category, 'M'),
      stage_group: str(tumor.stage_group, 10)?.toUpperCase() || null,
      grade: str(tumor.grade, 20),
    },
    biomarkers: (Array.isArray(raw.biomarkers) ? raw.biomarkers : [])
      .map((b) => ({ name: str(b?.name, 60), result: str(b?.result, 60) }))
      .filter((b) => b.name && b.result)
      .slice(0, 40),
    medications: (Array.isArray(raw.medications) ? raw.medications : []).map((m) => str(m, 120)).filter(Boolean).slice(0, 20),
    confidence: CONFIDENCE.includes(raw.confidence) ? raw.confidence : 'baja',
  };
}
