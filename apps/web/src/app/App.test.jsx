import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App authentication flow', () => {
  it('shows the login form when no session is available', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/iniciar sesión/i).length).toBeGreaterThan(0);
    });

    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });
});
