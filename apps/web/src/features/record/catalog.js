// Catálogos clínicos. Los códigos coinciden con apps/api/src/modules/clinical/catalog.js.

export const SITES = {
  brain: { label: 'Sistema nervioso central', short: 'SNC' },
  head_neck: { label: 'Cabeza y cuello', short: 'Cabeza y cuello' },
  thyroid: { label: 'Tiroides', short: 'Tiroides' },
  lung: { label: 'Pulmón', short: 'Pulmón', paired: true },
  breast: { label: 'Mama', short: 'Mama', paired: true },
  esophagus: { label: 'Esófago', short: 'Esófago' },
  stomach: { label: 'Estómago', short: 'Estómago' },
  liver: { label: 'Hígado y vías biliares', short: 'Hígado' },
  pancreas: { label: 'Páncreas', short: 'Páncreas' },
  colorectal: { label: 'Colon y recto', short: 'Colorrectal' },
  kidney: { label: 'Riñón', short: 'Riñón', paired: true },
  bladder: { label: 'Vejiga', short: 'Vejiga' },
  prostate: { label: 'Próstata', short: 'Próstata' },
  uterus_cervix: { label: 'Útero y cuello uterino', short: 'Útero' },
  ovary: { label: 'Ovario', short: 'Ovario', paired: true },
  testis: { label: 'Testículo', short: 'Testículo', paired: true },
  skin: { label: 'Piel y melanoma', short: 'Piel' },
  bone_soft_tissue: { label: 'Hueso y partes blandas', short: 'Sarcoma' },
  lymphatic: { label: 'Linfoma', short: 'Linfoma' },
  hematologic: { label: 'Hematológico (leucemia, mieloma)', short: 'Hematológico' },
  unknown_primary: { label: 'Primario desconocido', short: 'Primario desconocido' },
  other: { label: 'Otro', short: 'Otro' },
};

// Sitios sin una ubicación única en el esquema corporal: se eligen como chips.
export const SYSTEMIC_SITES = ['skin', 'bone_soft_tissue', 'lymphatic', 'hematologic', 'unknown_primary', 'other'];

export const LATERALITY_LABELS = {
  right: 'Derecho',
  left: 'Izquierdo',
  bilateral: 'Bilateral',
  midline: 'Línea media',
  na: 'No aplica',
};

export const T_OPTIONS = ['TX', 'T0', 'Tis', 'T1', 'T1mi', 'T1a', 'T1b', 'T1c', 'T2', 'T2a', 'T2b', 'T3', 'T4', 'T4a', 'T4b'];
export const N_OPTIONS = ['NX', 'N0', 'N1', 'N1mi', 'N1a', 'N1b', 'N1c', 'N2', 'N2a', 'N2b', 'N2c', 'N3', 'N3a', 'N3b', 'N3c'];
export const M_OPTIONS = ['M0', 'M1', 'M1a', 'M1b', 'M1c'];
export const STAGE_GROUPS = ['0', 'I', 'IA', 'IA1', 'IA2', 'IA3', 'IB', 'IC', 'II', 'IIA', 'IIB', 'IIC', 'III', 'IIIA', 'IIIB', 'IIIC', 'IV', 'IVA', 'IVB', 'IVC'];

export const TNM_PREFIX_LABELS = {
  c: 'c · clínico',
  p: 'p · patológico',
  yc: 'yc · clínico post-tratamiento',
  yp: 'yp · patológico post-neoadyuvancia',
  r: 'r · recurrencia',
};

export const TUMOR_STATUS_LABELS = {
  active: 'En tratamiento',
  stable: 'Enfermedad estable',
  remission: 'Remisión',
  progression: 'Progresión',
};

// Biomarcadores que se suelen pedir según el órgano; son sugerencias para cargar rápido.
export const BIOMARKER_PRESETS = {
  lung: ['EGFR', 'ALK', 'ROS1', 'KRAS G12C', 'BRAF V600E', 'PD-L1', 'MET ex14', 'RET', 'NTRK'],
  breast: ['RE', 'RP', 'HER2', 'Ki-67', 'BRCA1', 'BRCA2', 'PIK3CA'],
  colorectal: ['KRAS', 'NRAS', 'BRAF V600E', 'MSI / dMMR', 'HER2'],
  stomach: ['HER2', 'PD-L1 CPS', 'MSI / dMMR', 'Claudina 18.2'],
  esophagus: ['HER2', 'PD-L1 CPS', 'MSI / dMMR'],
  prostate: ['PSA', 'BRCA1', 'BRCA2', 'Gleason'],
  ovary: ['BRCA1', 'BRCA2', 'HRD', 'CA-125'],
  skin: ['BRAF V600', 'NRAS', 'c-KIT'],
  thyroid: ['BRAF V600E', 'RET', 'Tiroglobulina'],
  liver: ['AFP'],
  pancreas: ['CA 19-9', 'BRCA1', 'BRCA2', 'KRAS'],
  lymphatic: ['CD20', 'CD30', 'Ki-67'],
  hematologic: ['BCR-ABL', 'FLT3', 'NPM1', 'Cariotipo'],
};

export const TREATMENT_KIND_LABELS = {
  chemotherapy: 'Quimioterapia',
  immunotherapy: 'Inmunoterapia',
  targeted: 'Terapia dirigida',
  hormonal: 'Hormonoterapia',
  radiotherapy: 'Radioterapia',
  surgery: 'Cirugía',
  supportive: 'Soporte',
  other: 'Otro',
};

export const TREATMENT_INTENT_LABELS = {
  curative: 'Curativa',
  neoadjuvant: 'Neoadyuvante',
  adjuvant: 'Adyuvante',
  palliative: 'Paliativa',
  maintenance: 'Mantenimiento',
};

export const TREATMENT_STATUS_LABELS = {
  planned: 'Planificado',
  active: 'En curso',
  completed: 'Completado',
  suspended: 'Suspendido',
};

export const ECOG = [
  { value: 0, label: 'Totalmente activo, sin restricciones.' },
  { value: 1, label: 'Restricción en actividad intensa; ambulatorio, trabajo liviano.' },
  { value: 2, label: 'Ambulatorio y autónomo; no puede trabajar. Levantado más del 50% del día.' },
  { value: 3, label: 'Autocuidado limitado; en cama o silla más del 50% del día.' },
  { value: 4, label: 'Totalmente incapacitado; postrado.' },
];

export function siteLabel(tumor) {
  const site = SITES[tumor.primary_site]?.short || tumor.primary_site;
  const side = tumor.laterality && !['na', 'midline'].includes(tumor.laterality)
    ? ` ${LATERALITY_LABELS[tumor.laterality].toLowerCase()}`
    : '';
  return `${site}${side}`;
}

export function tnmString(tumor) {
  const parts = [tumor.t_category, tumor.n_category, tumor.m_category].filter(Boolean);
  return parts.length ? `${tumor.tnm_prefix || 'c'}${parts.join(' ')}` : '';
}

export function ageFrom(birthDate, today = new Date()) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
