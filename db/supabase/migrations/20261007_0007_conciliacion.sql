-- Onco-Salta Digital · Conciliación contra extractos (Etapa 4c)

create table public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  payer_id uuid references public.payers(id),
  file_name text,
  content_hash text not null,
  line_count integer not null default 0,
  credit_total numeric(14, 2) not null default 0,
  imported_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index statement_imports_hash on public.statement_imports (content_hash);

create table public.statement_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.statement_imports(id) on delete cascade,
  line_no integer not null,
  date date not null,
  description text not null default '',
  reference text not null default '',
  amount numeric(14, 2) not null,
  status text not null default 'unmatched' check (status in ('unmatched', 'proposed', 'review', 'matched', 'ignored')),
  candidates jsonb not null default '[]'::jsonb,
  matched_record_id uuid references public.billing_records(id),
  matched_by uuid references public.profiles(id),
  matched_at timestamptz
);

create index statement_lines_import on public.statement_lines (import_id, line_no);
create unique index statement_lines_one_per_record on public.statement_lines (matched_record_id) where matched_record_id is not null;

alter table public.billing_records
  add column payment_reference text;

alter table public.statement_imports enable row level security;
alter table public.statement_lines enable row level security;
-- Sin políticas para el navegador: la conciliación se maneja por la API.
