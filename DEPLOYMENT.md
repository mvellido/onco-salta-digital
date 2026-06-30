# Despliegue de Onco-Salta Digital

## 1) Frontend en Vercel

1. Sube el repositorio a GitHub.
2. Entra a https://vercel.com y crea un nuevo proyecto.
3. Selecciona la carpeta de frontend: `apps/web`.
4. Define el framework como `Vite`.
5. Configura las variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Haz deploy.

### Variables de entorno en Vercel
- `VITE_SUPABASE_URL`: URL del proyecto de Supabase, por ejemplo `https://xxxxx.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: clave anónima de Supabase
- `VITE_APP_NAME`: `Onco-Salta Digital`

### Archivo de configuración
- `apps/web/vercel.json`

---

## 2) Backend en Render

1. Sube el backend a GitHub si aún no lo está.
2. En Render, crea un nuevo servicio Web.
3. Conecta el repositorio y selecciona la carpeta `apps/api`.
4. Usa estos valores:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Añade las variables de entorno:
   - `NODE_ENV=production`
   - `PORT=10000` (Render lo inyecta automáticamente, no es necesario fijarlo manualmente)

### Variables de entorno en Render
- `NODE_ENV=production`
- `SUPABASE_URL` (opcional, si el backend lo necesita)
- `SUPABASE_SERVICE_ROLE_KEY` (opcional, si el backend hace operaciones del lado del servidor)

### Archivo de configuración
- `apps/api/render.yaml`

---

## 3) Base de datos en Supabase

La base ya está en Supabase, pero debes revisar estas configuraciones:

### Tablas y políticas
Asegúrate de tener creadas:
- `patients`
- `treatment_history`
- `event_attachments`

Las políticas RLS deben permitir acceso a doctores autenticados para sus pacientes.

### Bucket de Storage
Crea un bucket llamado `medical-history` y habilita:
- upload
- download
- list

---

## 4) URLs de redirección en Supabase Auth

Para que la autenticación funcione en producción, debes agregar estas URLs en Supabase Dashboard > Authentication > URL Configuration:

### Site URL
- `https://tu-frontend.vercel.app`

### Redirect URLs
- `https://tu-frontend.vercel.app/`
- `https://tu-frontend.vercel.app/**`
- `http://localhost:5173/`

Si usas rutas internas como `/patients/:id`, añade también:
- `https://tu-frontend.vercel.app/patients/*`

### Importante
Si tu app usa OAuth o magic links, agrega también las URLs de callback correspondientes.

---

## 5) Variables de entorno globales recomendadas

### Frontend (Vercel)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_NAME`

### Backend (Render)
- `NODE_ENV`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 6) Verificación final

Tras desplegar:

1. Abre la URL de Vercel.
2. Inicia sesión como doctor.
3. Comprueba que puedes ver pacientes y abrir el historial clínico.
4. Prueba adjuntar, previsualizar y eliminar un archivo.
5. Confirma que las URLs de redirección en Supabase están correctas.
