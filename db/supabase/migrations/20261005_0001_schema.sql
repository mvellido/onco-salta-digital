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
create or replace function public.handle_new_user()
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger patients_touch before update on public.patients
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

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
  for each row execute function public.touch_updated_at();

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
