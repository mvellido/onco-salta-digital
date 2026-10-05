# Despliegue del backend en Render y configuración de Vercel

> Antes de desplegar, la base de datos tiene que estar creada: ver [db/supabase/README.md](db/supabase/README.md).

Este documento guía el despliegue de `apps/api` en Render y la configuración de `VITE_API_URL` en Vercel para que la preview use el backend público.

## 1) Preparar y pushear cambios
```bash
# desde la raíz del repo
git add .
git commit -m "prepare: fallback API URL and deploy guide"
git push origin main
```

## 2) Deploy en Render
1. Crear cuenta o iniciar sesión en https://render.com
2. New → Web Service → Connect to GitHub → seleccionar `mvellido/onco-salta-digital` → rama `main`.
3. Render detectará `apps/api/render.yaml`; confirmar creación del servicio `onco-salta-api`.
4. En Environment → Environment Variables, añadir:
   - `SUPABASE_URL` = `https://<tu-proyecto>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = `<TU_SERVICE_ROLE_KEY>`
   - `GEMINI_API_KEY` = `<TU_CLAVE_GEMINI>`
   - `APP_URL` = `https://<tu-frontend>.vercel.app` (destino de los links de invitación)
   - `CORS_ALLOWED_ORIGINS` = `https://<tu-frontend>.vercel.app`
5. Lanzar deploy. Verificar logs y que `GET /health` responda `{ "status": "ok" }`.

Comprobación rápida:
```bash
curl https://<tu-backend-publico>/health
```

## 3) Configurar Vercel
1. Ir a https://vercel.com → proyecto `onco-salta-digital`.
2. Settings → Environment Variables.
3. Añadir:
   - Name: `VITE_API_URL`
   - Value: `https://<tu-backend-publico>` (sin slash final)
   - Environment: marcar `Preview` y `Production` (y `Development` si deseas).
4. Guardar y redeploy (o reabrir el Preview).

## Notas
- El frontend ahora usa `VITE_API_URL` si está presente; si no está presente y no estás en `development`, usará rutas relativas, por lo que `/appointments` será consultado contra el mismo origin.
- Si desplegás frontend y backend bajo el mismo dominio, las rutas relativas funcionan sin variables.

Si querés, puedo continuar: 1) crear el tag o commit y push final, 2) ayudarte paso a paso en Render y Vercel (indicá si me compartís acceso), o 3) validar la URL pública una vez desplegado.