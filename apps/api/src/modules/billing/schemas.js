export const billingRecordSchema = {
  type: 'object',
  required: ['invoice_number', 'amount', 'status'],
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    patient_id: { type: ['string', 'null'] },
    invoice_number: { type: 'string', minLength: 1 },
    amount: { type: 'number' },
    currency: { type: 'string', default: 'ARS' },
    status: { type: 'string', enum: ['pending', 'paid', 'overdue', 'cancelled'] },
    issued_at: { type: ['string', 'null'] },
    paid_at: { type: ['string', 'null'] },
    payer_name: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
  },
};

export const reconciliationRequestSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['records'],
  properties: {
    records: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['invoice_number', 'amount'],
        properties: {
          invoice_number: { type: 'string', minLength: 1 },
          amount: { type: 'number' },
          status: { type: 'string' },
          paid_at: { type: ['string', 'null'] },
        },
      },
    },
    expectedTotal: { type: ['number', 'null'] },
  },
};

export const reconciliationResultSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['summary', 'matched', 'unmatched'],
  properties: {
    summary: {
      type: 'object',
      required: ['totalRecords', 'matchedCount', 'unmatchedCount', 'totalAmount'],
      properties: {
        totalRecords: { type: 'number' },
        matchedCount: { type: 'number' },
        unmatchedCount: { type: 'number' },
        totalAmount: { type: 'number' },
        expectedTotal: { type: ['number', 'null'] },
        delta: { type: ['number', 'null'] },
      },
    },
    matched: { type: 'array' },
    unmatched: { type: 'array' },
  },
};
