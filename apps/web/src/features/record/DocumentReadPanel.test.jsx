import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiJson } = vi.hoisted(() => ({ apiJson: vi.fn() }));
vi.mock('../../lib/api', () => ({ apiJson }));

import DocumentReadPanel from './DocumentReadPanel';
import RecordAIPanel from './RecordAIPanel';

const EXTRACTION = {
  id: 'x1',
  method: 'pdf_text',
  summary: 'Adenocarcinoma de mama derecha, RE positivo.',
  model: 'gemini',
  created_at: '2026-10-06T10:00:00Z',
  extracted: {
    document_type: 'patologia',
    document_date: '2026-09-30',
    confidence: 'alta',
    findings: ['Carcinoma ductal infiltrante'],
    tumor: { primary_site: 'breast', laterality: 'right', histology: 'Carcinoma ductal', size_mm: 22 },
    biomarkers: [{ name: 'RE', result: 'positivo 90%' }, { name: 'HER2', result: 'negativo' }],
  },
};

const ATTACHMENT = { id: 'a1', file_name: 'ap.pdf' };

describe('DocumentReadPanel', () => {
  beforeEach(() => {
    apiJson.mockReset();
  });

  it('applies only the checked proposals to the chosen tumor, merging biomarkers', async () => {
    const onSaveTumor = vi.fn(async () => ({}));
    const tumors = [{ id: 't1', primary_site: 'breast', laterality: 'right', is_primary: true, biomarkers: [{ name: 'Ki-67', result: '20%' }, { name: 'HER2', result: 'pendiente' }] }];
    render(<DocumentReadPanel patientId="p1" attachment={ATTACHMENT} previous={EXTRACTION} tumors={tumors} canWrite onSaveTumor={onSaveTumor} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /tamaño/i }));
    fireEvent.click(screen.getByRole('button', { name: /aplicar a la ficha/i }));

    await waitFor(() => expect(onSaveTumor).toHaveBeenCalled());
    const [id, payload] = onSaveTumor.mock.calls[0];
    expect(id).toBe('t1');
    expect(payload.size_mm).toBeUndefined();
    expect(payload.histology).toBe('Carcinoma ductal');
    expect(payload.biomarkers).toEqual([
      { name: 'Ki-67', result: '20%' },
      { name: 'HER2', result: 'negativo' },
      { name: 'RE', result: 'positivo 90%' },
    ]);
  });

  it('asks for consent before sending a whole file', async () => {
    apiJson.mockRejectedValueOnce(Object.assign(new Error('Para leer una imagen hay que enviarla completa a Gemini.'), { status: 409 }));
    apiJson.mockResolvedValueOnce({ ...EXTRACTION, method: 'image' });
    render(<DocumentReadPanel patientId="p1" attachment={{ id: 'a2', file_name: 'tc.png' }} tumors={[]} canWrite onSaveTumor={vi.fn()} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /leer documento/i }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(/enviarla completa/);

    fireEvent.click(screen.getByRole('button', { name: /enviar el archivo completo/i }));
    expect(await screen.findByText(/archivo enviado completo/i)).toBeInTheDocument();
    expect(JSON.parse(apiJson.mock.calls[1][1].body)).toEqual({ allowFileUpload: true });
  });
});

describe('RecordAIPanel', () => {
  beforeEach(() => {
    apiJson.mockReset();
  });

  it('shows past answers with their cited guideline pages', async () => {
    apiJson.mockResolvedValueOnce([
      {
        question: '¿Primera línea?',
        answer: 'Inmunoterapia [1].',
        sources: [{ n: 1, guideline_id: 'g1', title: 'CPNM metastásico', organization: 'ESMO', version: '2025', page: 14 }],
        redactions: 2,
        provider: 'gemini',
        created_at: '2026-10-06T10:00:00Z',
      },
    ]);
    render(<RecordAIPanel patientId="p1" enabled disabledReason="" />);

    expect(await screen.findByText('Inmunoterapia [1].')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CPNM metastásico.*pág\. 14/ })).toBeInTheDocument();
    expect(screen.getByText(/2 datos personales ocultos/)).toBeInTheDocument();
  });
});
