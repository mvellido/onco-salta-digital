import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiJson } = vi.hoisted(() => ({ apiJson: vi.fn() }));
vi.mock('../../lib/api', () => ({ apiJson }));

import AppointmentForm from './AppointmentForm';
import { addDays, endTime, layoutLanes, startOfWeek } from './agendaUtils';

describe('agendaUtils', () => {
  it('computes the Monday of the week and crosses month boundaries', () => {
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12');
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(endTime({ time: '10:30', duration_minutes: 180 })).toBe('13:30');
  });

  it('places overlapping appointments side by side', () => {
    const placed = layoutLanes([
      { id: 'a', time: '09:00', duration_minutes: 60 },
      { id: 'b', time: '09:30', duration_minutes: 30 },
      { id: 'c', time: '11:00', duration_minutes: 30 },
    ]);
    const byId = Object.fromEntries(placed.map((p) => [p.appointment.id, p]));
    expect(byId.a.lane).toBe(0);
    expect(byId.b.lane).toBe(1);
    expect(byId.a.lanes).toBe(2);
    expect(byId.c.lanes).toBe(1);
  });
});

describe('AppointmentForm', () => {
  beforeEach(() => {
    apiJson.mockReset();
  });

  const patients = [{ id: 'p1', full_name: 'Paciente Uno', dni: '1', assigned_doctor_id: 'd1' }];
  const professionals = [{ id: 'd1', full_name: 'Dra. Uno' }];

  it('suggests the assigned doctor, offers free slots and allows an overbook after a conflict', async () => {
    apiJson.mockImplementation(async (path, options) => {
      if (path.startsWith('/agenda/free-slots')) return { date: '2026-10-12', slots: ['10:00', '10:30'], hasSchedule: true };
      if (path === '/appointments' && !JSON.parse(options.body).overbook) {
        throw new Error('El profesional ya tiene un turno que se superpone: 09:00. Podés darlo como sobreturno.');
      }
      return { id: 'new', ...JSON.parse(options.body), warnings: [] };
    });
    const onSaved = vi.fn();

    render(<AppointmentForm seed={{ date: '2026-10-12', time: '09:00' }} patients={patients} professionals={professionals} canWrite onSaved={onSaved} onDeleted={vi.fn()} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^paciente/i, { selector: 'select' }), { target: { value: 'p1' } });
    await waitFor(() => expect(screen.getByLabelText(/profesional/i)).toHaveValue('d1'));
    expect(await screen.findByRole('button', { name: '10:30' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'quimioterapia' } });
    expect(screen.getByLabelText(/duración/i)).toHaveValue(180);

    fireEvent.click(screen.getByRole('button', { name: /agendar/i }));
    fireEvent.click(await screen.findByRole('button', { name: /dar como sobreturno/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const body = JSON.parse(apiJson.mock.calls.at(-1)[1].body);
    expect(body).toMatchObject({ patient_id: 'p1', professional_id: 'd1', kind: 'quimioterapia', duration_minutes: 180, overbook: true });
  });
});
