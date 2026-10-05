import Ajv from 'ajv';
import { patientUpdateSchema } from '../modules/patients/schemas.js';
import { reconciliationRequestSchema } from '../modules/billing/schemas.js';
import { ROLES } from '../modules/shared/access.js';
import {
  tumorCreateSchema,
  tumorUpdateSchema,
  treatmentCreateSchema,
  treatmentUpdateSchema,
} from '../modules/clinical/schemas.js';

const ajv = new Ajv({ allErrors: true, removeAdditional: false });

const validators = {
  tumorCreate: ajv.compile(tumorCreateSchema),
  tumorUpdate: ajv.compile(tumorUpdateSchema),
  treatmentCreate: ajv.compile(treatmentCreateSchema),
  treatmentUpdate: ajv.compile(treatmentUpdateSchema),
  appointmentCreate: ajv.compile({
    type: 'object',
    additionalProperties: true,
    required: ['patient_id', 'date', 'time'],
    properties: {
      patient_id: { type: 'string', minLength: 1 },
      date: { type: 'string', minLength: 1 },
      time: { type: 'string', minLength: 1 },
      note: { type: 'string' },
      status: { type: 'string' },
    },
  }),
  appointmentUpdate: ajv.compile({
    type: 'object',
    additionalProperties: true,
    minProperties: 1,
    properties: {
      patient_id: { type: 'string', minLength: 1 },
      date: { type: 'string', minLength: 1 },
      time: { type: 'string', minLength: 1 },
      note: { type: 'string' },
      status: { type: 'string' },
    },
  }),
  patientUpdate: ajv.compile(patientUpdateSchema),
  iaConsult: ajv.compile({
    type: 'object',
    additionalProperties: true,
    required: ['question'],
    properties: {
      patientId: { type: 'string', minLength: 1 },
      question: { type: 'string', minLength: 1 },
      patientData: {
        type: 'object',
        additionalProperties: true,
        properties: {
          id: { type: 'string', minLength: 1 },
        },
      },
    },
  }),
  aiIngest: ajv.compile({
    type: 'object',
    additionalProperties: true,
    required: ['patientId'],
    anyOf: [
      { required: ['rawText'] },
      { required: ['documentReference'] },
    ],
    properties: {
      patientId: { type: 'string', minLength: 1 },
      rawText: { type: 'string', minLength: 1 },
      documentReference: { type: 'string', minLength: 1 },
    },
  }),
  aiRecommendations: ajv.compile({
    type: 'object',
    additionalProperties: true,
    required: ['patientId'],
    properties: {
      patientId: { type: 'string', minLength: 1 },
      clinicalQuestion: { type: 'string' },
    },
  }),
  aiChat: ajv.compile({
    type: 'object',
    additionalProperties: true,
    required: ['patientId', 'message'],
    properties: {
      patientId: { type: 'string', minLength: 1 },
      message: { type: 'string', minLength: 1 },
      history: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
          properties: {
            role: { type: 'string' },
            content: { type: 'string' },
          },
        },
      },
    },
  }),
  billingCreate: ajv.compile({
    type: 'object',
    additionalProperties: true,
    required: ['patient_id', 'invoice_number', 'amount'],
    properties: {
      patient_id: { type: 'string', minLength: 1 },
      invoice_number: { type: 'string', minLength: 1 },
      amount: { type: 'number' },
      currency: { type: 'string', minLength: 1 },
      status: { type: 'string' },
      issued_at: { type: 'string' },
      paid_at: { type: 'string' },
      payer_name: { type: 'string' },
      notes: { type: 'string' },
    },
  }),
  billingConciliate: ajv.compile(reconciliationRequestSchema),
  secretaryNotification: ajv.compile({
    type: 'object',
    additionalProperties: true,
    required: ['message'],
    properties: {
      channel: { type: 'string' },
      recipients: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
      },
      message: { type: 'string', minLength: 1 },
    },
  }),
  patientArchive: ajv.compile({
    type: 'object',
    required: ['reason'],
    additionalProperties: false,
    properties: {
      reason: { type: 'string', minLength: 3, maxLength: 500 },
    },
  }),
  patientCreateMeta: ajv.compile({
    type: 'object',
    additionalProperties: true,
    properties: {
      assigned_doctor_id: { type: 'string', minLength: 1 },
    },
  }),
  adminInvitation: ajv.compile({
    type: 'object',
    required: ['email', 'role'],
    additionalProperties: false,
    properties: {
      email: { type: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', maxLength: 254 },
      role: { type: 'string', enum: ROLES },
      full_name: { type: 'string', maxLength: 200 },
    },
  }),
  adminUserUpdate: ajv.compile({
    type: 'object',
    minProperties: 1,
    additionalProperties: false,
    properties: {
      role: { type: 'string', enum: ROLES },
      active: { type: 'boolean' },
    },
  }),
  rolePermissionUpdate: ajv.compile({
    type: 'object',
    additionalProperties: true,
    required: ['role', 'permissions'],
    properties: {
      role: { type: 'string', minLength: 1 },
      permissions: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
      },
    },
  }),
  documentUploadUrl: ajv.compile({
    type: 'object',
    required: ['fileName'],
    additionalProperties: true,
    properties: {
      fileName: { type: 'string', minLength: 1 },
    },
  }),
  documentDelete: ajv.compile({
    type: 'object',
    required: ['path'],
    additionalProperties: true,
    properties: {
      path: { type: 'string', minLength: 1 },
    },
  }),
};

export function validatePayload(schemaName, payload) {
  const validator = validators[schemaName];
  if (!validator) {
    return { ok: false, errors: [{ message: `Schema no encontrado: ${schemaName}` }] };
  }

  const ok = validator(payload || {});
  return {
    ok,
    errors: ok ? [] : (validator.errors || []),
  };
}
