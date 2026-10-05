import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiJson } = vi.hoisted(() => ({ apiJson: vi.fn() }));
vi.mock('../../lib/api', () => ({ apiJson }));

import ReconciliationPanel, { readCsvFile } from './ReconciliationPanel';

const STATEMENT = {
  import: { id: 'imp1', source_name: 'Banco', file_name: 'extracto.csv', created_at: '2026-10-05T10:00:00Z', line_count: 3, credit_total: 173300.5 },
  lines: [
    { id: 'l1', line_no: 3, date: '2026-10-01', description: 'TRANSF OS FC A-1', reference: '', amount: 125000, status: 'proposed', candidates: [{ record_id: 'r1', invoice_number: 'A-1', patient_id: 'p1', reasons: ['importe exacto', 'factura A-1 en el concepto'] }] },
    { id: 'l2', line_no: 4, date: '2026-10-03', description: 'TRANSFERENCIA', reference: '', amount: 48300.5, status: 'review', candidates: [{ record_id: 'r2', invoice_number: 'B-77', patient_id: 'p1', reasons: ['importe exacto'] }, { record_id: 'r3', invoice_number: 'B-78', patient_id: 'p2', reasons: ['importe exacto'] }] },
    { id: 'l3', line_no: 5, date: '2026-10-04', description: 'COMISION', reference: '', amount: -3500, status: 'ignored', candidates: [] },
  ],
};

describe('ReconciliationPanel', () => {
  beforeEach(() => {
    apiJson.mockReset();
  });

  it('decodes Windows-1252 bank exports', async () => {
    const bytes = new Uint8Array([0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0x70, 0x63, 0x69, 0xf3, 0x6e]); // "Descripción" en latin1
    const file = { arrayBuffer: async () => bytes.buffer };
    expect(await readCsvFile(file)).toBe('Descripción');
  });

  it('confirms the proposed match and the one chosen for review', async () => {
    apiJson.mockImplementation(async (path, options) => {
      if (path === '/billing/statements') return [STATEMENT.import];
      if (path === '/billing/statements/imp1') return STATEMENT;
      if (path === '/patients') return [{ id: 'p1', full_name: 'Paciente Uno' }, { id: 'p2', full_name: 'Paciente Dos' }];
      if (path === '/payers') return [];
      if (path.endsWith('/confirm')) return { confirmed: JSON.parse(options.body).matches.length, lines: [] };
      throw new Error(`inesperado ${path}`);
    });

    render(<ReconciliationPanel canWrite />);
    fireEvent.click(await screen.findByRole('button', { name: /banco/i }));

    expect(await screen.findByRole('button', { name: /confirmar 1 emparejamiento/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Factura para la fila 4'), { target: { value: 'r3' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar 2 emparejamientos/i }));

    await waitFor(() => expect(apiJson).toHaveBeenCalledWith('/billing/statements/imp1/confirm', expect.anything()));
    const call = apiJson.mock.calls.find(([path]) => path.endsWith('/confirm'));
    expect(JSON.parse(call[1].body).matches).toEqual([
      { line_id: 'l1', record_id: 'r1' },
      { line_id: 'l2', record_id: 'r3' },
    ]);
  });
});
