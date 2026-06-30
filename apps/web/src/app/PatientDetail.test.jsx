import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PatientDetail from './PatientDetail';

describe('PatientDetail', () => {
  it('renders the patient detail view with the timeline heading', () => {
    render(
      <MemoryRouter initialEntries={['/patients/1']}>
        <Routes>
          <Route
            path="/patients/:patientId"
            element={
              <PatientDetail
                user={{ id: 'doctor-1' }}
                initialPatient={{ id: '1', full_name: 'Ana Pérez', diagnosis_summary: 'Diagnóstico inicial', status: 'active' }}
                initialEvents={[]}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/historial clínico/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ana Pérez/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/sin eventos registrados/i)).toBeInTheDocument();
  });

  it('renders a search field to filter events by date or type', () => {
    render(
      <MemoryRouter initialEntries={['/patients/1']}>
        <Routes>
          <Route
            path="/patients/:patientId"
            element={
              <PatientDetail
                user={{ id: 'doctor-1' }}
                initialPatient={{ id: '1', full_name: 'Ana Pérez', diagnosis_summary: 'Diagnóstico inicial', status: 'active' }}
                initialEvents={[
                  { id: '1', event_date: '2026-06-10', event_type: 'Consulta de seguimiento', description: 'Control de evolución' },
                ]}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByPlaceholderText(/buscar por fecha o tipo/i).length).toBeGreaterThan(0);
  });
});
