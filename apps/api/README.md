# Backend - Documentación de Configuración

## Descripción

El backend de Onco-Salta Digital es una API Fastify que se conecta a Supabase para gestionar datos de pacientes, eventos clínicos y archivos adjuntos.

## Configuración Local (Desarrollo)

### 1. Variables de Entorno

Las variables de entorno se carga desde `apps/api/.env.local`:

```env
SUPABASE_URL=https://waoglprdtwybxroleorj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NODE_ENV=development
PORT=3001
```

### 2. Instalación de Dependencias

```bash
cd apps/api
npm install
```

Dependencias principales:
- `fastify@^5.0.0`: Framework web
- `@supabase/supabase-js@^2.110.0`: Cliente Supabase
- `dotenv`: Carga de variables de entorno

### 3. Ejecución en Desarrollo

```bash
npm run dev
```

El servidor escuchará en `http://0.0.0.0:3001` con hot-reload activado.

### 4. Ejecución en Producción

```bash
npm start
```

## Endpoints Disponibles

### Health Check
- **GET** `/health`
- Respuesta: `{ status: "ok" }`

### Pacientes

#### Listar Pacientes
- **GET** `/patients`
- Respuesta: Array de pacientes ordenados por `created_at` descendente

```json
[
  {
    "id": "uuid",
    "full_name": "Nombre del Paciente",
    "diagnosis_summary": "Resumen del diagnóstico",
    "status": "active",
    "assigned_doctor_id": "uuid",
    "created_at": "2024-01-01T12:00:00Z"
  }
]
```

#### Obtener Paciente por ID
- **GET** `/patients/:id`
- Parámetros: `id` (UUID)
- Respuesta: Objeto del paciente o error 404

#### Crear Paciente
- **POST** `/patients`
- Body:
  ```json
  {
    "full_name": "Nombre del Paciente",
    "diagnosis_summary": "Resumen del diagnóstico",
    "status": "active",
    "assigned_doctor_id": "uuid"
  }
  ```
- Respuesta: Objeto del paciente creado (status 201)

## Configuración en Producción (Render)

### 1. Ambiente Render

El archivo `render.yaml` contiene la configuración de despliegue:

```yaml
services:
  - type: web
    name: onco-salta-api
    env: node
    region: oregon
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
```

### 2. Configuración de Variables de Entorno en Render

En el dashboard de Render, crear las siguientes variables:

1. **SUPABASE_URL**
   - Valor: `https://waoglprdtwybxroleorj.supabase.co`

2. **SUPABASE_SERVICE_ROLE_KEY**
   - Valor: La clave de rol de servicio desde la consola de Supabase

### 3. Despliegue

1. Hacer push a GitHub
2. En Render.com, crear nuevo servicio web
3. Conectar repositorio GitHub (`mvellido/onco-salta-digital`)
4. Seleccionar rama `main`
5. Render detectará `render.yaml` automáticamente
6. Configurar variables de entorno en el dashboard
7. El despliegue comenzará automáticamente

## Manejo de Errores

El backend devuelve errores con códigos HTTP apropiados:

- **400**: Error de validación (datos requeridos faltantes)
- **404**: Recurso no encontrado
- **500**: Error interno del servidor

Ejemplo de respuesta de error:
```json
{
  "error": "Descripción del error"
}
```

## Integración con Frontend

El frontend en `apps/web` se conecta a este backend a través de variables de entorno:

```env
VITE_API_URL=http://localhost:3001  # Desarrollo
VITE_API_URL=https://onco-salta-api.render.com  # Producción
```

## Estructura de la Base de Datos

### Tabla `patients`

```sql
CREATE TABLE patients (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  diagnosis_summary TEXT,
  status TEXT DEFAULT 'active',
  assigned_doctor_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Row Level Security (RLS)

La tabla `patients` tiene políticas de RLS configuradas:
- Todos pueden leer pacientes
- Solo doctores autenticados pueden crear/actualizar pacientes

## Monitoreo en Producción

En Render.com:
1. Ver logs en tiempo real
2. Monitorear uso de recursos
3. Configurar alertas de error
4. Ver historial de despliegues

## Troubleshooting

### Error: "Variables de entorno no configuradas"
- Verificar que `.env.local` existe en `apps/api/`
- Verificar que `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` están configuradas

### Error de conexión a Supabase
- Verificar que la URL de Supabase es correcta
- Verificar que la SERVICE_ROLE_KEY es válida
- Verificar conectividad de red

### Puerto 3001 ya en uso
- Cambiar puerto: `PORT=3002 npm run dev`
- O matar proceso que ocupa el puerto

## Contacto

Para preguntas sobre el backend, contactar al equipo de desarrollo.
