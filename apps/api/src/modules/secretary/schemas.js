import { APPOINTMENT_KINDS, APPOINTMENT_STATUSES } from './service.js';

const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const time = { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' };

const appointmentProperties = {
  patient_id: { type: 'string', minLength: 1 },
  professional_id: { type: ['string', 'null'] },
  date,
  time,
  duration_minutes: { type: 'integer', minimum: 5, maximum: 480 },
  kind: { type: 'string', enum: APPOINTMENT_KINDS },
  resource: { type: ['string', 'null'], maxLength: 60 },
  note: { type: 'string', maxLength: 1000 },
  status: { type: 'string', enum: APPOINTMENT_STATUSES },
  overbook: { type: 'boolean' },
};

export const appointmentCreateSchema = {
  type: 'object',
  required: ['patient_id', 'date', 'time'],
  additionalProperties: false,
  properties: appointmentProperties,
};

export const appointmentUpdateSchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: appointmentProperties,
};

export const scheduleReplaceSchema = {
  type: 'object',
  required: ['blocks'],
  additionalProperties: false,
  properties: {
    blocks: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        required: ['weekday', 'start_time', 'end_time'],
        additionalProperties: false,
        properties: {
          weekday: { type: 'integer', minimum: 1, maximum: 7 },
          start_time: time,
          end_time: time,
          slot_minutes: { type: 'integer', minimum: 5, maximum: 240 },
          resource: { type: ['string', 'null'], maxLength: 60 },
        },
      },
    },
  },
};
