# Onco-Salta Digital - Guía de Despliegue Completa

## Arquitectura del Proyecto

```
┌─────────────────────────────────────────────────────────────┐
│                   Usuarios / Navegador                       │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    [Frontend]    [Supabase]       [Backend API]
  (Vercel)       (Cloud)          (Render)
  React 18.3    PostgreSQL         Fastify 5.0
  Vite 5.4      Auth, RLS,        Node.js
                Storage Bucket
```

## Componentes Principales

### 1. Frontend (Vercel) ✅ YA DESPLEGADO
- **URL**: https://onco-salta-digital.vercel.app/
- **Tecnología**: React 18.3.1 + Vite 5.4.10
- **Rol**: Interfaz de usuario para gestionar pacientes y eventos clínicos
- **Estado**: Funcionando en producción

### 2. Backend (Render) 🔄 LISTO PARA DESPLEGAR
- **URL**: Será https://onco-salta-api.render.com
- **Tecnología**: Fastify 5.0.0 + Node.js
- **Rol**: API REST para gestionar datos de pacientes
- **Estado**: Código listo, requiere configuración en Render

### 3. Base de Datos (Supabase) ✅ CONFIGURADA
- **URL**: https://waoglprdtwybxroleorj.supabase.co
- **Tecnología**: PostgreSQL + Autenticación + Storage
- **Rol**: Almacenar datos de pacientes, eventos, archivos adjuntos
- **Estado**: Base de datos en producción

---

## 1) Frontend en Vercel ✅ COMPLETADO

### Estado Actual
- ✅ Frontend ya está desplegado en Vercel
- ✅ URL: https://onco-salta-digital.vercel.app/
- ✅ Login funcionando
- ✅ Dashboard de pacientes funcional
- ✅ Upload de archivos médicos funcionando

### Configuración Vercel
```
Project: onco-salta-digital
Root Directory: apps/web
Build Command: vite build
Output Directory: dist
Framework: Vite
```

### Variables de Entorno en Vercel
- `VITE_SUPABASE_URL`: https://waoglprdtwybxroleorj.supabase.co
- `VITE_SUPABASE_ANON_KEY`: [clave pública de Supabase]

### Archivos de Configuración
- `apps/web/vercel.json`
- `vercel.json` (raíz)

---

## 2) Backend en Render 🔄 PASO A PASO

### Estado Actual
- ✅ Código backend listo con Supabase
- ✅ Endpoints implementados: GET/POST /patients
- ✅ Configuración render.yaml completa
- ⏳ Requiere despliegue manual en Render

### Paso 1: Crear Cuenta en Render
1. Ir a https://render.com
2. Hacer signup/login con GitHub
3. Autorizar acceso a repositorios

### Paso 2: Crear Nuevo Servicio
1. Dashboard de Render → New +
2. Seleccionar "Web Service"
3. Conectar repositorio: `mvellido/onco-salta-digital`
4. Seleccionar rama: `main`

### Paso 3: Configurar Servicio
1. **Name**: `onco-salta-api`
2. **Root Directory**: `apps/api`
3. **Runtime**: Node
4. **Build Command**: `npm install`
5. **Start Command**: `npm start`
6. **Instance Type**: Free (o Paid si necesitas mejor performance)

### Paso 4: Configurar Variables de Entorno
En el formulario de Variables, añadir:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | `https://waoglprdtwybxroleorj.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | [Ver en Supabase Dashboard] |
| `PORT` | `3001` |

### Paso 5: Deploy
Render detectará automáticamente `render.yaml` y creará el servicio.

### Obtener SERVICE_ROLE_KEY de Supabase
1. Ir a https://app.supabase.com
2. Seleccionar proyecto: `waoglprdtwybxroleorj`
3. Settings → API
4. En "Service role key", copiar la clave completa
5. Pegarla en Render como `SUPABASE_SERVICE_ROLE_KEY`

### Archivo de Configuración
- `apps/api/render.yaml`
- `apps/api/package.json`
- `apps/api/src/index.js`

### Verificar Despliegue
Una vez desplegado, probar:
```bash
curl https://onco-salta-api.render.com/health
# Debe retornar: {"status":"ok"}

curl https://onco-salta-api.render.com/patients
# Debe retornar: [lista de pacientes]
```

---

## 3) Base de Datos en Supabase ✅ CONFIGURADA

### Estado Actual
- ✅ Base de datos PostgreSQL creada
- ✅ Tablas: patients, treatment_history, event_attachments
- ✅ Bucket de almacenamiento: medical-history
- ✅ RLS (Row Level Security) configurado
- ✅ Autenticación habilitada

### Tablas

#### patients
```sql
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  diagnosis_summary TEXT,
  status TEXT DEFAULT 'active',
  assigned_doctor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### treatment_history
```sql
CREATE TABLE treatment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  event_type TEXT,
  description TEXT,
  event_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### event_attachments
```sql
CREATE TABLE event_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES treatment_history(id) ON DELETE CASCADE,
  file_name TEXT,
  file_size INTEGER,
  file_path TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Storage Bucket
- **Nombre**: medical-history
- **Privado**: Sí (requiere autenticación)
- **Rutas**: `{doctorId}/patient_{patientId}/event_{eventId}/{timestamp}-{filename}`

### Políticas de Acceso (RLS)
- Consultas: Públicas (para testing) o restringidas a usuarios autenticados
- Escritura: Solo usuarios autenticados (doctores)

---

## Desarrollo Local

### Requisitos
- Node.js 16+
- npm 7+
- Git

### Setup Inicial

```bash
# Clonar repositorio
git clone https://github.com/mvellido/onco-salta-digital.git
cd onco-salta-digital

# Instalar dependencias del monorepo
npm install
```

### Variables de Entorno (Local)

#### Frontend - `apps/web/.env.local`
```env
VITE_SUPABASE_URL=https://waoglprdtwybxroleorj.supabase.co
VITE_SUPABASE_ANON_KEY=[clave pública]
VITE_API_URL=http://localhost:3001
```

#### Backend - `apps/api/.env.local`
```env
SUPABASE_URL=https://waoglprdtwybxroleorj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[clave de servicio]
NODE_ENV=development
PORT=3001
```

### Ejecutar Desarrollo Local

#### Terminal 1 - Backend
```bash
cd apps/api
npm install
npm run dev
# Escucha en http://localhost:3001
```

#### Terminal 2 - Frontend
```bash
cd apps/web
npm install
npm run dev
# Abre http://localhost:5173 automáticamente
```

---

## Flujo de Trabajo Git

### 1. Desarrollo
```bash
# Crear rama
git checkout -b feat/mi-feature

# Hacer cambios
# ...

# Commit
git add .
git commit -m "feat: descripción del cambio"

# Push
git push origin feat/mi-feature

# Pull request en GitHub
```

### 2. Deploy Automático
- **Frontend**: Merge a `main` → Vercel redeploy automático
- **Backend**: Merge a `main` → Render redeploy automático (cuando esté configurado)

---

## Monitoreo en Producción

### Vercel Analytics
- Dashboard: https://vercel.com/projects
- Ver logs de build
- Monitorear Web Vitals

### Render Logs
- Dashboard: https://dashboard.render.com/
- Ver logs en tiempo real
- Monitorear CPU y memoria

### Supabase Dashboard
- URL: https://app.supabase.com
- Ver logs de la base de datos
- Monitorear autenticación
- Estadísticas de almacenamiento

---

## Testing

### Frontend
```bash
cd apps/web
npm run test          # Tests once
npm run test:watch   # Watch mode
npm run test:ui      # Interactive UI
npm run coverage     # Coverage report
```

### Backend (cuando esté implementado)
```bash
cd apps/api
npm run test
```

---

## Troubleshooting

### Vercel
**Problema**: Build falla
**Solución**: Revisar en Vercel → Deployments → últimas logs

**Problema**: Frontend no se conecta a backend
**Solución**: Verificar VITE_API_URL en .env.local

### Render (cuando esté configurado)
**Problema**: Servicio no inicia
**Solución**: Revisar logs en Render Dashboard, verificar variables de entorno

**Problema**: Error de conexión a Supabase
**Solución**: Verificar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY

### Local
**Problema**: Puerto 3001 ya en uso
**Solución**: `PORT=3002 npm run dev`

---

## Recursos Útiles

- **GitHub**: https://github.com/mvellido/onco-salta-digital
- **Vercel**: https://vercel.com
- **Render**: https://render.com
- **Supabase**: https://supabase.com
- **React Docs**: https://react.dev
- **Fastify Docs**: https://www.fastify.io/

---

## Resumen de Estado

| Componente | Estado | URL | Notas |
|-----------|--------|-----|-------|
| Frontend | ✅ Activo | https://onco-salta-digital.vercel.app/ | Desplegado y funcionando |
| Backend | 🔄 Listo | Pendiente | Código listo, requiere setup en Render |
| Base de Datos | ✅ Activa | Supabase | PostgreSQL funcionando |
| Autenticación | ✅ Activa | Supabase Auth | Email/Password |
| Storage | ✅ Activo | Supabase Storage | medical-history bucket |

---

**Última actualización**: 2024
**Responsable del proyecto**: Equipo de Desarrollo

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
