import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateClient, mockGetSession, mockOnAuthStateChange, mockSignInWithPassword, mockSignOut } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const mockOnAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }));
  const mockSignInWithPassword = vi.fn();
  const mockSignOut = vi.fn();
  const mockCreateClient = vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  }));

  return { mockCreateClient, mockGetSession, mockOnAuthStateChange, mockSignInWithPassword, mockSignOut };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

import App from './App';

const PROFILES = {
  doctor: {
    id: 'doctor-1',
    email: 'doc@example.com',
    full_name: 'Dra. Prueba',
    role: 'doctor',
    permissions: ['patients:read', 'patients:read_basic', 'patients:write', 'patients:archive', 'appointments:read', 'appointments:write', 'billing:read', 'ai:use'],
  },
  secretary: {
    id: 'sec-1',
    email: 'sec@example.com',
    full_name: null,
    role: 'secretary',
    permissions: ['patients:read_basic', 'appointments:read', 'appointments:write', 'notifications:send', 'scope:all_patients'],
  },
};

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

// Simula la API: /me según el perfil y listas vacías para el resto.
function mockApi(meStatus, meBody) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).endsWith('/me')) return jsonResponse(meStatus, meBody);
    if (String(url).includes('/billing/reports')) return jsonResponse(200, { totals: { total: 0, paidAmount: 0, openAmount: 0, byStatus: {} }, count: 0, records: [] });
    return jsonResponse(200, []);
  }));
}

function signedInAs(profile) {
  mockGetSession.mockResolvedValue({ data: { session: { access_token: 't', user: { id: profile.id, email: profile.email } } } });
  mockApi(200, profile);
}

describe('App authentication flow', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mockSignInWithPassword.mockResolvedValue({ data: { session: { user: { id: 'doctor-1', email: 'doc@example.com' } } }, error: null });
    mockSignOut.mockResolvedValue({ error: null });
    mockApi(200, PROFILES.doctor);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the login form when no session is available', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/iniciar sesión/i).length).toBeGreaterThan(0);
    });

    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it('does not offer self sign-up: access is by invitation only', async () => {
    render(<App />);

    await screen.findByLabelText(/correo electrónico/i);
    expect(screen.queryByRole('button', { name: /registrar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/solo por invitación/i)).toBeInTheDocument();
  });

  it('redirects to the dashboard after a successful sign in', async () => {
    render(<App />);

    fireEvent.change(await screen.findByLabelText(/correo electrónico/i), { target: { value: 'doc@example.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'doc@example.com', password: 'secret123' });
    });

    expect(await screen.findByText(/plataforma clínica oncológica/i)).toBeInTheDocument();
  });
});

describe('Dashboard by role', () => {
  beforeEach(() => {
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows clinical sections and the patient form to a doctor', async () => {
    signedInAs(PROFILES.doctor);
    render(<App />);

    expect(await screen.findByRole('link', { name: /sección de asistencia ia/i })).toBeInTheDocument();
    expect(await screen.findByText(/registrar paciente/i)).toBeInTheDocument();
    expect(screen.getByText('Médico/a')).toBeInTheDocument();
  });

  it('hides AI, billing and the patient form from the secretary', async () => {
    signedInAs(PROFILES.secretary);
    render(<App />);

    expect(await screen.findByRole('link', { name: /sección de secretaría y turnos/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sección de asistencia ia/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sección financiera/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /pacientes/i })).toBeInTheDocument();
    expect(screen.queryByText(/registrar paciente/i)).not.toBeInTheDocument();
  });

  it('blocks a signed-in user without an active invitation', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 't', user: { id: 'x', email: 'x@example.com' } } } });
    mockApi(403, { error: 'Tu usuario no está habilitado. Pedí una invitación al administrador.' });
    render(<App />);

    expect(await screen.findByText(/sin acceso/i)).toBeInTheDocument();
    expect(screen.getByText(/no está habilitado/i)).toBeInTheDocument();
  });
});
