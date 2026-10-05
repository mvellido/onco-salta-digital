-- ARCHIVO GENERADO: concatenación de setup/00_reset_onco_previo.sql,
-- migrations/20261005_0001_schema.sql, migrations/20261005_0002_security.sql
-- y setup/99_bootstrap_admin.sql. Pegar completo en Supabase → SQL Editor → Run.
-- Corre dentro de una transacción: si algo falla, no queda nada a medias.

begin;

-- Limpieza del esquema anterior de Onco-Salta en el proyecto compartido con la
-- plataforma de cursos. Solo toca objetos de Onco-Salta: las tablas alumnos,
-- clases, modulos, progreso, notas y anuncios, y el bucket recursos, quedan intactos.
-- Los datos eran de prueba; hay copia local en db/backups/ (fuera de git).

drop table if exists
  public.event_attachments,
  public.treatment_history,
  public.vital_signs,
  public.audit_logs,
  public.appointments,
  public.billing_records,
  public.user_roles,
  public.clinical_documents,
  public.treatments,
  public.tumors,
  public.patients
cascade;

-- Funciones del esquema anterior (se borran todas sus variantes de firma).
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('is_doctor', 'can_access_patient')
  loop
    execute 'drop function ' || r.signature || ' cascade';
  end loop;
end $$;

-- Políticas viejas del bucket medical-history (algunas permitían a cualquier
-- usuario autenticado leer todos los archivos).
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%medical-history%'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

-- Onco-Salta Digital · Esquema base (Etapa 1)
-- Reemplaza las migraciones del 24/08/2026 y los SQL sueltos de apps/web/src/app/.
-- Los nombres de columna coinciden con los que usa la API (apps/api/src/modules/*).


-- ---------------------------------------------------------------------------
-- Usuarios, roles e invitaciones
-- ---------------------------------------------------------------------------

create table public.role_permissions (
  role text not null check (role in ('admin', 'doctor', 'secretary', 'finance')),
  permission text not null,
  primary key (role, permission)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('admin', 'doctor', 'secretary', 'finance')),
  full_name text,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index invitations_one_pending_per_email
  on public.invitations (lower(email))
  where accepted_at is null and revoked_at is null;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text check (role in ('admin', 'doctor', 'secretary', 'finance')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Al crearse un usuario en Supabase Auth, su perfil toma el rol de la invitación
-- pendiente para ese email. Nunca se usa el rol que venga en los metadatos del
-- usuario: un registro sin invitación queda sin rol e inactivo.
create or replace function public.onco_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations;
begin
  select * into inv
  from public.invitations
  where lower(email) = lower(new.email)
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  insert into public.profiles (id, email, full_name, role, active)
  values (new.id, new.email, inv.full_name, inv.role, inv.id is not null);

  if inv.id is not null then
    update public.invitations set accepted_at = now() where id = inv.id;
  end if;

  return new;
end;
$$;

create trigger onco_on_auth_user_created
  after insert on auth.users
  for each row execute function public.onco_handle_new_user();

-- ---------------------------------------------------------------------------
-- Pacientes
-- ---------------------------------------------------------------------------

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  dni text,
  birth_date date,
  gender text not null default 'No especificado'
    check (gender in ('Masculino', 'Femenino', 'Otro', 'No especificado')),
  contact text,
  status text not null default 'active'
    check (status in ('active', 'follow_up', 'discharged', 'deceased')),
  diagnosis_summary text not null default '',
  -- Resumen tumoral provisorio; la Etapa 2 lo pasa a una tabla con TNM.
  tumor_location text,
  tumor_stage text,
  molecular_markers jsonb not null default '{}'::jsonb,
  assigned_doctor_id uuid not null references public.profiles(id),
  -- Baja lógica: la historia clínica se conserva (Ley 26.529, art. 18).
  archived_at timestamptz,
  archived_by uuid references public.profiles(id),
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index patients_dni_unique on public.patients (dni) where dni is not null;
create index patients_assigned_doctor on public.patients (assigned_doctor_id) where archived_at is null;

-- Ningún rol, ni siquiera la clave de servicio, puede borrar físicamente un paciente.
create or replace function public.prevent_patient_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Los pacientes no se eliminan: archivalos con archived_at (retención legal de la historia clínica).'
    using errcode = 'P0001';
end;
$$;

create trigger patients_no_delete
  before delete on public.patients
  for each row execute function public.prevent_patient_delete();

create or replace function public.onco_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger patients_touch before update on public.patients
  for each row execute function public.onco_touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.onco_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Historia clínica
-- ---------------------------------------------------------------------------

create table public.treatment_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  event_date date not null default current_date,
  event_type text not null,
  description text not null,
  outcome_note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index treatment_history_patient on public.treatment_history (patient_id, event_date desc);

create table public.event_attachments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.treatment_history(id) on delete restrict,
  file_name text not null,
  storage_path text not null,
  content_type text,
  size bigint,
  uploaded_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index event_attachments_event on public.event_attachments (event_id);

create table public.vital_signs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  blood_pressure_systolic integer check (blood_pressure_systolic between 40 and 300),
  blood_pressure_diastolic integer check (blood_pressure_diastolic between 20 and 200),
  heart_rate integer check (heart_rate between 20 and 250),
  temperature numeric(4, 2) check (temperature between 30 and 45),
  weight numeric(5, 2) check (weight > 0),
  height numeric(5, 2) check (height > 0),
  oxygen_saturation integer check (oxygen_saturation between 0 and 100),
  recorded_by uuid references public.profiles(id) default auth.uid(),
  recorded_at timestamptz not null default now()
);

create index vital_signs_patient on public.vital_signs (patient_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Turnos y facturación
-- ---------------------------------------------------------------------------

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  date date not null,
  time text not null,
  note text not null default '',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'completed', 'cancelled')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_patient on public.appointments (patient_id, date);
create trigger appointments_touch before update on public.appointments
  for each row execute function public.onco_touch_updated_at();

create table public.billing_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  invoice_number text not null,
  amount numeric(14, 2) not null,
  currency text not null default 'ARS',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  issued_at timestamptz,
  paid_at timestamptz,
  payer_name text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index billing_invoice_unique on public.billing_records (invoice_number);
create index billing_patient on public.billing_records (patient_id, status);

-- ---------------------------------------------------------------------------
-- Auditoría (solo inserción)
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  patient_id uuid references public.patients(id) on delete restrict,
  resource_type text,
  resource_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_actor_created on public.audit_logs (actor_id, created_at desc);
create index audit_patient_created on public.audit_logs (patient_id, created_at desc);

create or replace function public.prevent_audit_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'La auditoría no se modifica ni se borra.' using errcode = 'P0001';
end;
$$;

create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function public.prevent_audit_change();

-- ---------------------------------------------------------------------------
-- Permisos por defecto
-- ---------------------------------------------------------------------------
-- patients:read       ficha clínica completa
-- patients:read_basic nombre, DNI y contacto (para agendar o facturar)
-- scope:all_patients  ve a todos los pacientes; sin él, solo los asignados

insert into public.role_permissions (role, permission) values
  ('admin', 'patients:read'), ('admin', 'patients:read_basic'), ('admin', 'patients:write'),
  ('admin', 'patients:archive'), ('admin', 'appointments:read'), ('admin', 'appointments:write'),
  ('admin', 'billing:read'), ('admin', 'billing:write'), ('admin', 'ai:use'),
  ('admin', 'notifications:send'), ('admin', 'users:manage'), ('admin', 'audit:read'),
  ('admin', 'scope:all_patients'),

  ('doctor', 'patients:read'), ('doctor', 'patients:read_basic'), ('doctor', 'patients:write'),
  ('doctor', 'patients:archive'), ('doctor', 'appointments:read'), ('doctor', 'appointments:write'),
  ('doctor', 'billing:read'), ('doctor', 'ai:use'),

  ('secretary', 'patients:read_basic'), ('secretary', 'appointments:read'),
  ('secretary', 'appointments:write'), ('secretary', 'notifications:send'),
  ('secretary', 'scope:all_patients'),

  ('finance', 'patients:read_basic'), ('finance', 'billing:read'), ('finance', 'billing:write'),
  ('finance', 'scope:all_patients');

-- Onco-Salta Digital · Permisos y Row Level Security (Etapa 1)
--
-- Modelo: la API usa la clave de servicio (salta RLS) y verifica permisos en código
-- con la misma tabla role_permissions. RLS protege el acceso directo desde el
-- navegador con la anon key, que hoy usa la ficha del paciente para la historia,
-- adjuntos y signos vitales. Turnos, facturación, invitaciones y auditoría solo
-- se acceden desde la API: no tienen políticas para el rol authenticated.

-- ---------------------------------------------------------------------------
-- Funciones de ayuda
-- ---------------------------------------------------------------------------

create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role = p.role
    where p.id = auth.uid()
      and p.active
      and rp.permission = perm
  );
$$;

create or replace function public.can_access_patient(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_patient_id is not null and (
    public.has_permission('scope:all_patients')
    or exists (
      select 1 from public.patients
      where id = target_patient_id
        and assigned_doctor_id = auth.uid()
    )
  );
$$;

create or replace function public.can_access_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.treatment_history th
    where th.id = target_event_id
      and public.can_access_patient(th.patient_id)
  );
$$;

-- Convierte un segmento de ruta en uuid sin fallar con rutas mal formadas.
create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.onco_handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.role_permissions enable row level security;
alter table public.invitations enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.treatment_history enable row level security;
alter table public.event_attachments enable row level security;
alter table public.vital_signs enable row level security;
alter table public.appointments enable row level security;
alter table public.billing_records enable row level security;
alter table public.audit_logs enable row level security;

-- Cada usuario ve su propio perfil y los permisos de su rol.
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy role_permissions_select_own_role on public.role_permissions
  for select to authenticated
  using (role = (select role from public.profiles where id = auth.uid() and active));

-- Pacientes: lectura directa solo de la ficha completa (patients:read).
-- Secretaría y finanzas obtienen datos básicos a través de la API.
create policy patients_select on public.patients
  for select to authenticated
  using (public.has_permission('patients:read') and public.can_access_patient(id));

-- Alta y edición de pacientes solo por la API (valida, audita y protege
-- assigned_doctor_id y los campos de archivo).

-- Historia clínica: se agrega y se corrige, no se borra.
create policy history_select on public.treatment_history
  for select to authenticated
  using (public.has_permission('patients:read') and public.can_access_patient(patient_id));

create policy history_insert on public.treatment_history
  for insert to authenticated
  with check (public.has_permission('patients:write') and public.can_access_patient(patient_id));

create policy history_update on public.treatment_history
  for update to authenticated
  using (public.has_permission('patients:write') and public.can_access_patient(patient_id))
  with check (public.has_permission('patients:write') and public.can_access_patient(patient_id));

create policy attachments_select on public.event_attachments
  for select to authenticated
  using (public.has_permission('patients:read') and public.can_access_event(event_id));

create policy attachments_insert on public.event_attachments
  for insert to authenticated
  with check (public.has_permission('patients:write') and public.can_access_event(event_id));

create policy attachments_delete on public.event_attachments
  for delete to authenticated
  using (public.has_permission('patients:write') and public.can_access_event(event_id));

create policy vitals_select on public.vital_signs
  for select to authenticated
  using (public.has_permission('patients:read') and public.can_access_patient(patient_id));

create policy vitals_insert on public.vital_signs
  for insert to authenticated
  with check (public.has_permission('patients:write') and public.can_access_patient(patient_id));

-- ---------------------------------------------------------------------------
-- Storage: bucket privado, rutas patients/<patient_id>/...
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('medical-history', 'medical-history', false)
on conflict (id) do update set public = false;

create policy medical_history_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'medical-history'
    and (storage.foldername(name))[1] = 'patients'
    and public.has_permission('patients:read')
    and public.can_access_patient(public.try_uuid((storage.foldername(name))[2]))
  );

create policy medical_history_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'medical-history'
    and (storage.foldername(name))[1] = 'patients'
    and public.has_permission('patients:write')
    and public.can_access_patient(public.try_uuid((storage.foldername(name))[2]))
  );

create policy medical_history_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'medical-history'
    and (storage.foldername(name))[1] = 'patients'
    and public.has_permission('patients:write')
    and public.can_access_patient(public.try_uuid((storage.foldername(name))[2]))
  );

-- Perfiles para los usuarios que ya existían antes de instalar el esquema
-- (el trigger de invitaciones solo actúa sobre usuarios nuevos).
-- El dueño del proyecto queda como administrador; el resto, sin rol e inactivo
-- hasta que el administrador lo habilite desde Configuración.

insert into public.profiles (id, email, role, active)
select id, email, 'admin', true
from auth.users
where lower(email) = 'mvellido@gmail.com'
on conflict (id) do update set role = 'admin', active = true;

insert into public.profiles (id, email, role, active)
select id, email, null, false
from auth.users
on conflict (id) do nothing;

commit;
