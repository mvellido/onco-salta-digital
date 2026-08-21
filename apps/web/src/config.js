// Configuración de la API
// En desarrollo usa localhost:3001 por compatibilidad.
// En preview/producción preferimos una URL explícita definida
// en `VITE_API_URL`. Si no está definida en producción, usamos
// ruta relativa (''), de modo que las llamadas sean relativas
// al mismo origin (p. ej. /appointments) — útil si el backend
// se sirve desde el mismo dominio o mediante proxy del host.
const envApiUrl = import.meta.env.VITE_API_URL;
export const API_URL = envApiUrl !== undefined
	? envApiUrl
	: (import.meta.env.MODE === 'development' ? 'http://localhost:3001' : '');