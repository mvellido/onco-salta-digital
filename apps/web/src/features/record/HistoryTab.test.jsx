import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HistoryTab from './HistoryTab';

describe('HistoryTab', () => {
  it('renders the clinical history with an empty state', () => {
    render(<HistoryTab patientId="1" user={{ id: 'doctor-1' }} initialEvents={[]} />);

    expect(screen.getByText(/historial clínico/i)).toBeInTheDocument();
    expect(screen.getByText(/sin eventos registrados/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /agregar evento/i })).toBeInTheDocument();
  });

  it('renders a search field to filter events by date or type', () => {
    render(
      <HistoryTab
        patientId="1"
        user={{ id: 'doctor-1' }}
        initialEvents={[{ id: '1', event_date: '2026-06-10', event_type: 'Consulta de seguimiento', description: 'Control de evolución' }]}
      />
    );

    expect(screen.getAllByPlaceholderText(/buscar por fecha o tipo/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/control de evolución/i)).toBeInTheDocument();
  });

  it('hides editing controls without write permission', () => {
    render(
      <HistoryTab
        patientId="1"
        user={{ id: 'x' }}
        canWrite={false}
        initialEvents={[{ id: '1', event_date: '2026-06-10', event_type: 'Diagnóstico', description: 'Biopsia' }]}
      />
    );

    expect(screen.queryByRole('heading', { name: /agregar evento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
  });
});
