export const PAYER_KINDS = ['obra_social', 'prepaga', 'pami', 'art', 'particular', 'otro'];
export const AUTHORIZATION_STATUSES = ['draft', 'submitted', 'observed', 'approved', 'rejected'];
export const EXPIRY_WARNING_DAYS = 15;

const date = { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const text = (max) => ({ type: ['string', 'null'], maxLength: max });

export const payerSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 120 },
    kind: { type: 'string', enum: PAYER_KINDS },
    rnos: text(20),
    cuit: text(20),
    contact: text(200),
    active: { type: 'boolean' },
  },
};
export const payerCreateSchema = { ...payerSchema, required: ['name'] };
export const payerUpdateSchema = { ...payerSchema, minProperties: 1 };

const coverageProperties = {
  payer_id: { type: 'string', minLength: 1 },
  member_number: text(40),
  plan: text(60),
  valid_from: date,
  valid_to: date,
  is_primary: { type: 'boolean' },
};
export const coverageCreateSchema = { type: 'object', required: ['payer_id'], additionalProperties: false, properties: coverageProperties };
export const coverageUpdateSchema = { type: 'object', minProperties: 1, additionalProperties: false, properties: coverageProperties };

const authorizationProperties = {
  coverage_id: { type: ['string', 'null'] },
  payer_id: { type: 'string', minLength: 1 },
  treatment_id: { type: ['string', 'null'] },
  item: { type: 'string', minLength: 3, maxLength: 300 },
  quantity: text(60),
  status: { type: 'string', enum: AUTHORIZATION_STATUSES },
  requested_on: date,
  responded_on: date,
  authorization_number: text(60),
  valid_until: date,
  notes: text(1000),
};
export const authorizationCreateSchema = { type: 'object', required: ['item'], additionalProperties: false, properties: authorizationProperties };
export const authorizationUpdateSchema = { type: 'object', minProperties: 1, additionalProperties: false, properties: authorizationProperties };

const TRANSITIONS = {
  draft: ['draft', 'submitted'],
  submitted: ['submitted', 'observed', 'approved', 'rejected'],
  observed: ['observed', 'submitted', 'approved', 'rejected'],
  approved: ['approved'],
  rejected: ['rejected', 'submitted'],
};

export const STATUS_LABELS = {
  draft: 'borrador',
  submitted: 'presentada',
  observed: 'observada',
  approved: 'aprobada',
  rejected: 'rechazada',
};

const today = () => new Date().toISOString().slice(0, 10);

// Valida el cambio de estado y completa fechas por defecto. Devuelve { error } o { changes }.
export function applyAuthorizationChange(current, input) {
  const from = current?.status || 'draft';
  const to = input.status || from;

  if (!(TRANSITIONS[from] || []).includes(to)) {
    return { error: `No se puede pasar de ${STATUS_LABELS[from]} a ${STATUS_LABELS[to]}.` };
  }

  const merged = { ...current, ...input, status: to };
  const changes = { ...input, status: to };

  if (to === 'submitted' && from !== 'submitted' && !merged.requested_on) changes.requested_on = today();
  if (['approved', 'rejected', 'observed'].includes(to) && from !== to && !merged.responded_on) changes.responded_on = today();

  if (to === 'approved' && !merged.authorization_number?.trim()) {
    return { error: 'Para marcarla aprobada cargá el número de autorización.' };
  }
  if (merged.valid_until && merged.requested_on && merged.valid_until < merged.requested_on) {
    return { error: 'El vencimiento no puede ser anterior a la fecha de presentación.' };
  }

  return { changes };
}

export function withExpiry(authorization, reference = today()) {
  if (authorization.status !== 'approved' || !authorization.valid_until) return { ...authorization, expiry: null };
  const days = Math.round((Date.parse(authorization.valid_until) - Date.parse(reference)) / 86400000);
  return { ...authorization, expiry: days < 0 ? 'expired' : days <= EXPIRY_WARNING_DAYS ? 'soon' : null, days_left: days };
}
