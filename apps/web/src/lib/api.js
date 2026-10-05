import { supabase } from '../app/supabaseClient';
import { API_URL } from '../config';

export async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const fallbackBaseUrl = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost';
  const requestUrl = API_URL ? `${API_URL}${normalizedPath}` : `${fallbackBaseUrl}${normalizedPath}`;

  const response = await fetch(requestUrl, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const configHint = API_URL
      ? `Revisa VITE_API_URL (${API_URL}) y asegurate de que apunte al backend API.`
      : 'Definí VITE_API_URL para Preview/Production apuntando al backend API.';
    throw new Error(`La API devolvió HTML en lugar de JSON para ${normalizedPath}. ${configHint}`);
  }

  return response;
}

// Atajo para JSON: devuelve el cuerpo o lanza un Error con el mensaje de la API.
export async function apiJson(path, options = {}) {
  const response = await apiFetch(path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}
