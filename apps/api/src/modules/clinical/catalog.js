// Catálogos clínicos compartidos con el frontend (apps/web/src/features/record/catalog.js).
// Si se agrega un código acá, agregarlo también allá.

export const PRIMARY_SITES = [
  'brain',
  'head_neck',
  'thyroid',
  'lung',
  'breast',
  'esophagus',
  'stomach',
  'liver',
  'pancreas',
  'colorectal',
  'kidney',
  'bladder',
  'prostate',
  'uterus_cervix',
  'ovary',
  'testis',
  'skin',
  'bone_soft_tissue',
  'lymphatic',
  'hematologic',
  'unknown_primary',
  'other',
];

export const LATERALITIES = ['left', 'right', 'bilateral', 'midline', 'na'];
export const TNM_PREFIXES = ['c', 'p', 'yc', 'yp', 'r'];
export const TUMOR_STATUSES = ['active', 'remission', 'progression', 'stable'];

export const TREATMENT_KINDS = [
  'chemotherapy',
  'immunotherapy',
  'targeted',
  'hormonal',
  'radiotherapy',
  'surgery',
  'supportive',
  'other',
];
export const TREATMENT_INTENTS = ['curative', 'neoadjuvant', 'adjuvant', 'palliative', 'maintenance'];
export const TREATMENT_STATUSES = ['planned', 'active', 'completed', 'suspended'];
