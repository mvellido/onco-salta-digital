# Base de datos de Onco-Salta Digital

Todo el esquema vive en `migrations/`. Son las únicas fuentes de verdad: no hay que crear tablas a mano en el panel de Supabase.

| Archivo | Qué crea |
|---|---|
| `20261005_0001_schema.sql` | Tablas, roles por defecto, trigger de invitaciones, bloqueo de borrado de pacientes y auditoría inmutable |
| `20261005_0002_security.sql` | Funciones de permisos, políticas RLS y el bucket privado `medical-history` |

## Instalación en el proyecto actual (compartido con la plataforma de cursos)

Mientras dure el desarrollo, Onco-Salta usa el mismo proyecto de Supabase que la plataforma de cursos. Para ese caso está `setup/INSTALAR_proyecto_compartido.sql`: borra solo el esquema anterior de Onco-Salta, aplica las dos migraciones y deja a mvellido@gmail.com como administrador. No toca las tablas del curso ni el bucket `recursos`.

En este proyecto **no** hay que desactivar el registro público (paso 3 de abajo), porque lo usa el curso. Un registro nuevo queda con perfil inactivo y sin acceso a Onco-Salta.

Cuando el sistema esté listo para usarse, se pasa a un proyecto dedicado siguiendo los pasos de abajo.

## Puesta en marcha en un proyecto nuevo

1. **Crear el proyecto** en [supabase.com](https://supabase.com). Elegí la región São Paulo (`sa-east-1`), la más cercana a Salta.
2. **Correr las migraciones en orden.** En *SQL Editor*, pegá el contenido de `0001` y ejecutalo; después, el de `0002`. Con la CLI de Supabase alcanza con `supabase db push`.
3. **Cerrar el registro público.** En *Authentication → Sign In / Providers*, desactivá *Allow new users to sign up*. Las invitaciones siguen funcionando con el registro cerrado.
4. **Configurar las URLs.** En *Authentication → URL Configuration*:
   - *Site URL*: la URL del frontend, por ejemplo `https://onco-salta.vercel.app`.
   - *Redirect URLs*: agregá `https://onco-salta.vercel.app/bienvenida` y, para desarrollo, `http://localhost:5173/bienvenida`.
5. **Crear el primer administrador.** El sistema solo da rol a quien tiene una invitación, así que el primer admin se invita a mano:
   ```sql
   insert into public.invitations (email, role, full_name)
   values ('tu-email@ejemplo.com', 'admin', 'Tu Nombre');
   ```
   Después, en *Authentication → Users → Invite user*, invitá ese mismo email. Cuando abras el link del correo, vas a crear tu contraseña y entrar como administrador. Desde ahí, el resto del equipo se invita desde *Configuración* en la app.
6. **Cargar las variables de entorno.**
   - API (`apps/api/.env.local` en desarrollo, panel de Render en producción): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `APP_URL` (URL del frontend, sin `/` final) y `CORS_ALLOWED_ORIGINS`.
   - Frontend (`apps/web/.env.local` o panel de Vercel): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_API_URL`.

   `VITE_DOCTOR_INVITE_CODE` ya no se usa y se puede borrar.

## Modelo de acceso

| Rol | Ve | Puede |
|---|---|---|
| Administración | Todos los pacientes, ficha completa | Todo, incluido invitar usuarios y editar permisos |
| Médico/a | Sus pacientes asignados, ficha completa | Cargar, editar y archivar pacientes; turnos; IA; ver facturación |
| Secretaría | Todos los pacientes, solo nombre, DNI y contacto | Turnos y avisos |
| Finanzas | Todos los pacientes, solo nombre, DNI y contacto | Facturación |

Los permisos de cada rol se editan desde *Configuración → Permisos por rol* (tabla `role_permissions`). El rol de administración no puede perder `users:manage`, para que siempre quede alguien capaz de administrar.

Hay dos capas de protección:

- **La API** usa la clave de servicio y verifica el permiso en cada endpoint.
- **RLS** protege lo que el navegador lee directo con la anon key: la ficha, la historia clínica, los adjuntos y los signos vitales. Turnos, facturación, invitaciones y auditoría no tienen políticas para el navegador: solo se acceden por la API.

## Retención de la historia clínica

La Ley 26.529 (art. 18) obliga a conservar la historia clínica al menos 10 años. Por eso:

- Los pacientes **se archivan** (`archived_at`, `archived_by`, `archive_reason`), no se borran. Un trigger rechaza cualquier `DELETE` sobre `patients`, incluso desde la clave de servicio.
- Las tablas clínicas usan `on delete restrict`: no hay borrados en cascada.
- La auditoría (`audit_logs`) no se puede modificar ni borrar.
- Los adjuntos de un evento todavía se pueden eliminar desde la ficha, para corregir cargas equivocadas. Revisar esta regla con el equipo médico.
