import {
  PRIMARY_SITES,
  LATERALITIES,
  TNM_PREFIXES,
  TUMOR_STATUSES,
  TREATMENT_KINDS,
  TREATMENT_INTENTS,
  TREATMENT_STATUSES,
} from './catalog.js';

const nullableString = (maxLength) => ({ type: ['string', 'null'], maxLength });
const isoDate = { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' };

const tumorProperties = {
  primary_site: { type: 'string', enum: PRIMARY_SITES },
  laterality: { type: 'string', enum: LATERALITIES },
  site_detail: nullableString(200),
  histology: nullableString(200),
  size_mm: { type: ['integer', 'null'], minimum: 1, maximum: 999 },
  tnm_prefix: { type: 'string', enum: TNM_PREFIXES },
  t_category: nullableString(10),
  n_category: nullableString(10),
  m_category: nullableString(10),
  stage_group: nullableString(10),
  grade: nullableString(20),
  diagnosis_date: isoDate,
  biomarkers: {
    type: 'array',
    maxItems: 40,
    items: {
      type: 'object',
      required: ['name', 'result'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 60 },
        result: { type: 'string', minLength: 1, maxLength: 60 },
      },
    },
  },
  status: { type: 'string', enum: TUMOR_STATUSES },
  is_primary: { type: 'boolean' },
  notes: nullableString(2000),
};

export const tumorCreateSchema = {
  type: 'object',
  required: ['primary_site'],
  additionalProperties: false,
  properties: tumorProperties,
};

export const tumorUpdateSchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: tumorProperties,
};

const treatmentProperties = {
  tumor_id: { type: ['string', 'null'] },
  kind: { type: 'string', enum: TREATMENT_KINDS },
  regimen: { type: 'string', minLength: 1, maxLength: 200 },
  dose: nullableString(120),
  frequency: nullableString(120),
  intent: { type: ['string', 'null'], enum: [...TREATMENT_INTENTS, null] },
  line: { type: ['integer', 'null'], minimum: 1, maximum: 10 },
  start_date: isoDate,
  end_date: isoDate,
  cycles_planned: { type: ['integer', 'null'], minimum: 1, maximum: 100 },
  cycles_done: { type: 'integer', minimum: 0, maximum: 100 },
  status: { type: 'string', enum: TREATMENT_STATUSES },
  suspension_reason: nullableString(500),
  notes: nullableString(2000),
};

export const treatmentCreateSchema = {
  type: 'object',
  required: ['kind', 'regimen'],
  additionalProperties: false,
  properties: treatmentProperties,
};

export const treatmentUpdateSchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: treatmentProperties,
};
