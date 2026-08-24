export const patientUpdateSchema = {
  type: 'object',
  additionalProperties: true,
  minProperties: 1,
  properties: {
    full_name: { type: 'string', minLength: 1 },
    diagnosis_summary: { type: 'string' },
    status: { type: 'string' },
    dni: { type: ['string', 'null'] },
    birth_date: { type: ['string', 'null'] },
    gender: { type: ['string', 'null'] },
    contact: { type: ['string', 'null'] },
    tumor_location: { type: ['string', 'null'] },
    tumor_stage: { type: ['string', 'null'] },
    molecular_markers: { type: ['object', 'null'] },
  },
};

export const patientTimelineEventSchema = {
  type: 'object',
  required: ['id', 'event_date', 'event_type', 'description'],
  properties: {
    id: { type: 'string' },
    event_date: { type: 'string' },
    event_type: { type: 'string' },
    description: { type: 'string' },
    outcome_note: { type: ['string', 'null'] },
    created_by: { type: ['string', 'null'] },
    created_at: { type: 'string' },
    attachments_count: { type: 'number' },
  },
};
