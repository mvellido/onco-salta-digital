create extension if not exists pgcrypto;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  document_number text,
  date_of_birth date,
  sex text,
  contact_info jsonb,
  status text default 'active',
  diagnosis_summary text,
  assigned_doctor_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  treatment_type text not null,
  start_date date,
  end_date date,
  status text default 'active',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.tumors (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  tumor_location text,
  stage text,
  molecular_markers jsonb,
  diagnosis_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.clinical_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  document_type text,
  storage_path text,
  ocr_text text,
  extracted_metadata jsonb,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  date date not null,
  time text not null,
  note text,
  status text default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  invoice_number text not null,
  amount numeric(14,2) not null,
  currency text default 'ARS',
  status text default 'pending',
  issued_at timestamptz,
  paid_at timestamptz,
  payer_name text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null,
  permissions jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  patient_id uuid references public.patients(id) on delete set null,
  resource_type text,
  resource_id uuid,
  action text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_patients_assigned_doctor on public.patients(assigned_doctor_id);
create index if not exists idx_appointments_patient on public.appointments(patient_id, date);
create index if not exists idx_billing_patient on public.billing_records(patient_id, status);
create index if not exists idx_audit_actor_created_at on public.audit_logs(actor_id, created_at desc);
