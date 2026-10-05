// Datos ficticios para la vista de ejemplo (/demo/ficha, solo en desarrollo).
// No corresponden a ninguna persona real.

const svgStudy = (label, tone) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#0e1a18"/><ellipse cx="160" cy="122" rx="118" ry="92" fill="#1d2b28"/><ellipse cx="112" cy="118" rx="44" ry="64" fill="${tone}"/><ellipse cx="208" cy="118" rx="44" ry="64" fill="${tone}"/><circle cx="222" cy="92" r="11" fill="#d9d4cf"/><text x="12" y="228" fill="#9fb8b2" font-family="monospace" font-size="12">${label}</text></svg>`
)}`;

export const DEMO_RECORD = {
  id: 'demo-patient',
  full_name: 'Paciente de ejemplo',
  dni: '00000000',
  birth_date: '1968-03-15',
  gender: 'Femenino',
  contact: '+54 387 000-0000',
  status: 'active',
  diagnosis_summary: 'Adenocarcinoma de pulmón izquierdo en tratamiento de primera línea.',
  ecog: 1,
  ecog_updated_at: '2026-09-20T10:00:00Z',
  allergies: ['Platino'],
  archived_at: null,
  tumors: [
    {
      id: 'demo-tumor',
      primary_site: 'lung',
      laterality: 'left',
      site_detail: 'Lóbulo superior izquierdo, periférico',
      histology: 'Adenocarcinoma',
      size_mm: 35,
      tnm_prefix: 'c',
      t_category: 'T2a',
      n_category: 'N1',
      m_category: 'M0',
      stage_group: 'IIB',
      grade: 'G2',
      diagnosis_date: '2026-06-12',
      biomarkers: [
        { name: 'EGFR', result: 'negativo' },
        { name: 'ALK', result: 'negativo' },
        { name: 'PD-L1', result: '60%' },
      ],
      status: 'active',
      is_primary: true,
      notes: '',
    },
  ],
  treatments: [
    {
      id: 'demo-tx-1',
      kind: 'immunotherapy',
      regimen: 'Pembrolizumab',
      dose: '200 mg',
      frequency: 'cada 21 días',
      intent: 'curative',
      line: 1,
      tumor_id: 'demo-tumor',
      start_date: '2026-07-15',
      end_date: null,
      cycles_planned: 6,
      cycles_done: 4,
      status: 'active',
      suspension_reason: null,
      notes: '',
    },
    {
      id: 'demo-tx-2',
      kind: 'supportive',
      regimen: 'Ondansetrón',
      dose: '8 mg',
      frequency: 'si náuseas',
      intent: null,
      line: null,
      tumor_id: null,
      start_date: '2026-07-15',
      end_date: null,
      cycles_planned: null,
      cycles_done: 0,
      status: 'active',
      suspension_reason: null,
      notes: '',
    },
  ],
  timeline: [
    { id: 'demo-ev-3', event_date: '2026-09-20', event_type: 'Consulta de seguimiento', description: 'Buena tolerancia al 4.º ciclo. Sin toxicidad inmunomediada.', outcome_note: 'Continúa esquema.' },
    { id: 'demo-ev-2', event_date: '2026-07-02', event_type: 'Otro', description: 'Comité de tumores: indicación de inmunoterapia de primera línea.', outcome_note: null },
    { id: 'demo-ev-1', event_date: '2026-06-20', event_type: 'Diagnóstico', description: 'Biopsia por fibrobroncoscopía: adenocarcinoma.', outcome_note: null },
  ],
};

export const DEMO_ATTACHMENTS = [
  { id: 'demo-att-1', event_id: 'demo-ev-1', file_name: 'tc-torax-inicial.png', content_type: 'image/png', created_at: '2026-06-12', url: svgStudy('TC TÓRAX 12/06/2026', '#3a4a46') },
  { id: 'demo-att-2', event_id: 'demo-ev-3', file_name: 'tc-torax-control.png', content_type: 'image/png', created_at: '2026-09-18', url: svgStudy('TC TÓRAX 18/09/2026', '#34443f') },
];

export const DEMO_VITALS = [
  { id: 'v4', recorded_at: '2026-09-20T10:00:00Z', blood_pressure_systolic: 124, blood_pressure_diastolic: 78, heart_rate: 76, temperature: 36.5, oxygen_saturation: 96, weight: 63.1 },
  { id: 'v3', recorded_at: '2026-08-26T10:00:00Z', blood_pressure_systolic: 118, blood_pressure_diastolic: 76, heart_rate: 80, temperature: 36.7, oxygen_saturation: 95, weight: 63.8 },
  { id: 'v2', recorded_at: '2026-08-05T10:00:00Z', blood_pressure_systolic: 122, blood_pressure_diastolic: 80, heart_rate: 82, temperature: 36.4, oxygen_saturation: 95, weight: 64.9 },
  { id: 'v1', recorded_at: '2026-07-15T10:00:00Z', blood_pressure_systolic: 128, blood_pressure_diastolic: 82, heart_rate: 84, temperature: 36.6, oxygen_saturation: 94, weight: 66.0 },
];
