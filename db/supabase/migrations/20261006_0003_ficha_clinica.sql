-- Onco-Salta Digital · Ficha clínica (Etapa 2)
-- Tumores con TNM y biomarcadores, tratamientos, ECOG y alergias.
-- El resumen tumoral en texto libre de patients pasa a la tabla tumors.

-- ---------------------------------------------------------------------------
-- Paciente: estado funcional y alergias
-- ---------------------------------------------------------------------------

alter table public.patients
  add column ecog smallint check (ecog between 0 and 4),
  add column ecog_updated_at timestamptz,
  add column allergies text[] not null default '{}';

alter table public.patients
  drop column tumor_location,
  drop column tumor_stage,
  drop column molecular_markers;

-- ---------------------------------------------------------------------------
-- Tumores
-- ---------------------------------------------------------------------------
-- primary_site usa los códigos del mapa anatómico del frontend
-- (apps/web/src/features/record/anatomy.js). La estadificación (stage_group)
-- la elige el médico: no se calcula, porque las reglas AJCC dependen del órgano.

create table public.tumors (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  primary_site text not null,
  laterality text not null default 'na'
    check (laterality in ('left', 'right', 'bilateral', 'midline', 'na')),
  site_detail text,
  histology text,
  size_mm integer check (size_mm > 0 and size_mm < 1000),
  tnm_prefix text not null default 'c' check (tnm_prefix in ('c', 'p', 'yc', 'yp', 'r')),
  t_category text,
  n_category text,
  m_category text,
  stage_group text,
  grade text,
  diagnosis_date date,
  biomarkers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(biomarkers) = 'array'),
  status text not null default 'active'
    check (status in ('active', 'remission', 'progression', 'stable')),
  is_primary boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tumors_patient on public.tumors (patient_id);
create trigger tumors_touch before update on public.tumors
  for each row execute function public.onco_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Tratamientos
-- ---------------------------------------------------------------------------

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  tumor_id uuid references public.tumors(id) on delete restrict,
  kind text not null check (kind in (
    'chemotherapy', 'immunotherapy', 'targeted', 'hormonal',
    'radiotherapy', 'surgery', 'supportive', 'other'
  )),
  regimen text not null,
  dose text,
  frequency text,
  intent text check (intent in ('curative', 'neoadjuvant', 'adjuvant', 'palliative', 'maintenance')),
  line smallint check (line between 1 and 10),
  start_date date,
  end_date date,
  cycles_planned smallint check (cycles_planned > 0),
  cycles_done smallint not null default 0 check (cycles_done >= 0),
  status text not null default 'planned'
    check (status in ('planned', 'active', 'completed', 'suspended')),
  suspension_reason text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index treatments_patient on public.treatments (patient_id, start_date desc);
create trigger treatments_touch before update on public.treatments
  for each row execute function public.onco_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: lectura directa con patients:read; altas y cambios por la API
-- ---------------------------------------------------------------------------

alter table public.tumors enable row level security;
alter table public.treatments enable row level security;

create policy tumors_select on public.tumors
  for select to authenticated
  using (public.has_permission('patients:read') and public.can_access_patient(patient_id));

create policy treatments_select on public.treatments
  for select to authenticated
  using (public.has_permission('patients:read') and public.can_access_patient(patient_id));
