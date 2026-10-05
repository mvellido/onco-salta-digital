import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PatientRecordView from './PatientRecordView';
import { DEMO_RECORD, DEMO_ATTACHMENTS, DEMO_VITALS } from './demoRecord';

vi.mock('../../app/supabaseClient', () => ({ supabase: { from: vi.fn(), storage: { from: vi.fn() } } }));

function renderRecord(props = {}) {
  const handlers = {
    onUpdatePatient: vi.fn(async () => {}),
    onSaveTumor: vi.fn(async (id, payload) => ({ ...payload, id: id || 'nuevo' })),
    onSaveTreatment: vi.fn(async () => {}),
  };
  render(
    <MemoryRouter>
      <PatientRecordView
        record={DEMO_RECORD}
        user={{ id: 'doc' }}
        canWrite
        canUseAI={false}
        demo={{ attachments: DEMO_ATTACHMENTS, vitals: DEMO_VITALS }}
        {...handlers}
        {...props}
      />
    </MemoryRouter>
  );
  return handlers;
}

describe('PatientRecordView', () => {
  it('shows the clinical header: diagnosis, TNM, ECOG and allergies', () => {
    renderRecord();
    expect(screen.getByRole('heading', { name: /paciente de ejemplo/i })).toBeInTheDocument();
    expect(screen.getByText(/adenocarcinoma · pulmón izquierdo/i)).toBeInTheDocument();
    expect(screen.getByText(/cT2a N1 M0 · Estadio IIB/)).toBeInTheDocument();
    expect(screen.getByText('ECOG 1')).toBeInTheDocument();
    expect(screen.getByText(/alergia: platino/i)).toBeInTheDocument();
  });

  it('switches tabs with number keys and shows the TNM grid', () => {
    renderRecord();
    fireEvent.keyDown(window, { key: '2' });
    expect(screen.getByRole('tab', { name: /tumor/i })).toHaveAttribute('aria-selected', 'true');
    const tnm = screen.getByLabelText(/estadificación tnm/i);
    expect(within(tnm).getByText('2a')).toBeInTheDocument();
    expect(within(tnm).getByText('IIB')).toBeInTheDocument();
    expect(screen.getByText('3,5 cm')).toBeInTheDocument();
  });

  it('does not switch tabs while typing in a field', () => {
    renderRecord();
    const input = screen.getByLabelText(/nueva alergia/i);
    fireEvent.keyDown(input, { key: '3' });
    expect(screen.getByRole('tab', { name: /datos/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('picks the site on the anatomy map and sends a clean payload', async () => {
    const { onSaveTumor } = renderRecord();
    fireEvent.click(screen.getByRole('tab', { name: /tumor/i }));
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Mama derecho' }));
    expect(screen.getByRole('heading', { name: 'Mama' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ HER2' }));
    fireEvent.change(screen.getByLabelText('Resultado de HER2'), { target: { value: 'positivo (3+)' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar tumor/i }));

    await waitFor(() => expect(onSaveTumor).toHaveBeenCalled());
    const [id, payload] = onSaveTumor.mock.calls[0];
    expect(id).toBe('demo-tumor');
    expect(payload.primary_site).toBe('breast');
    expect(payload.laterality).toBe('right');
    expect(payload.biomarkers).toContainEqual({ name: 'HER2', result: 'positivo (3+)' });
    expect(payload.size_mm).toBe(35);
  });

  it('marks treatments with cycle progress and adds a cycle', async () => {
    const { onSaveTreatment } = renderRecord();
    fireEvent.click(screen.getByRole('tab', { name: /tratamientos/i }));
    expect(screen.getByLabelText('4 de 6 ciclos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+1 ciclo' }));
    expect(onSaveTreatment).toHaveBeenCalledWith('demo-tx-1', { cycles_done: 5 });
  });

  it('hides editing in an archived record', () => {
    renderRecord({ record: { ...DEMO_RECORD, archived_at: '2026-10-01', archive_reason: 'Derivado' } });
    expect(screen.getByText(/paciente archivado \(derivado\)/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
  });
});
