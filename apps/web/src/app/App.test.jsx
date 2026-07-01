import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    })),
  }));

  return { mockCreateClient, mockGetSession, mockOnAuthStateChange, mockSignInWithPassword, mockSignOut };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

import App from './App';

describe('App authentication flow', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mockSignInWithPassword.mockResolvedValue({ data: { session: { user: { id: 'doctor-1', email: 'doc@example.com' } } }, error: null });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('shows the login form when no session is available', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/iniciar sesión/i).length).toBeGreaterThan(0);
    });

    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it('redirects to the dashboard after a successful sign in', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: 'doc@example.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'doc@example.com', password: 'secret123' });
    });

    expect(await screen.findByText(/gestión clínica rápida/i)).toBeInTheDocument();
  });
});
