-- Onco-Salta Digital · Obras sociales, coberturas y autorizaciones (Etapa 4b)
-- El catálogo de financiadores lo carga cada centro: no se precargan nombres,
-- códigos RNOS ni valores para no inventar datos.

create table public.payers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'obra_social'
    check (kind in ('obra_social', 'prepaga', 'pami', 'art', 'particular', 'otro')),
  rnos text,
  cuit text,
  contact text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index payers_name_unique on public.payers (lower(name));

create table public.patient_coverages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  payer_id uuid not null references public.payers(id),
  member_number text,
  plan text,
  valid_from date,
  valid_to date,
  is_primary boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create unique index patient_coverages_one_primary on public.patient_coverages (patient_id) where is_primary;
create index patient_coverages_patient on public.patient_coverages (patient_id);

-- Autorizaciones previas (medicación de alto costo, radioterapia, estudios).
create table public.authorizations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  coverage_id uuid references public.patient_coverages(id),
  payer_id uuid not null references public.payers(id),
  treatment_id uuid references public.treatments(id),
  item text not null,
  quantity text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'observed', 'approved', 'rejected')),
  requested_on date,
  responded_on date,
  authorization_number text,
  valid_until date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or authorization_number is not null)
);

create index authorizations_patient on public.authorizations (patient_id, created_at desc);
create index authorizations_status on public.authorizations (status, valid_until);
create trigger authorizations_touch before update on public.authorizations
  for each row execute function public.onco_touch_updated_at();

alter table public.billing_records
  add column payer_id uuid references public.payers(id),
  add column authorization_id uuid references public.authorizations(id);

-- Permiso para la gestión administrativa de coberturas y autorizaciones.
insert into public.role_permissions (role, permission) values
  ('admin', 'coverage:manage'),
  ('secretary', 'coverage:manage'),
  ('finance', 'coverage:manage')
on conflict do nothing;

alter table public.payers enable row level security;
alter table public.patient_coverages enable row level security;
alter table public.authorizations enable row level security;

-- Lectura de la cobertura desde la ficha; las altas y cambios van por la API.
create policy coverages_select on public.patient_coverages
  for select to authenticated
  using (public.has_permission('patients:read') and public.can_access_patient(patient_id));

create policy authorizations_select on public.authorizations
  for select to authenticated
  using (public.has_permission('patients:read') and public.can_access_patient(patient_id));

create policy payers_select on public.payers
  for select to authenticated
  using (auth.uid() is not null);
