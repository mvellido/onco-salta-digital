-- Onco-Salta Digital · IA segura (Etapa 3)
-- Historial de consultas, lecturas de documentos y biblioteca de guías con
-- búsqueda semántica (pgvector, embeddings de 768 dimensiones).

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Historial de consultas a la IA
-- ---------------------------------------------------------------------------

create table public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  actor_id uuid references public.profiles(id),
  kind text not null check (kind in ('chat', 'recommendations', 'ingest')),
  question text not null,
  answer text not null,
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  model text,
  provider text,
  redactions integer not null default 0,
  created_at timestamptz not null default now()
);

create index ai_interactions_patient on public.ai_interactions (patient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Lecturas de documentos clínicos (PDF o imagen adjuntos a la historia)
-- ---------------------------------------------------------------------------

create table public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  attachment_id uuid not null references public.event_attachments(id) on delete restrict,
  method text not null check (method in ('pdf_text', 'image')),
  summary text not null,
  extracted jsonb not null default '{}'::jsonb,
  redactions integer not null default 0,
  model text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index document_extractions_patient on public.document_extractions (patient_id, created_at desc);
create index document_extractions_attachment on public.document_extractions (attachment_id);

-- ---------------------------------------------------------------------------
-- Biblioteca de guías clínicas
-- ---------------------------------------------------------------------------
-- Cada centro sube las guías que tiene derecho a usar (por ejemplo, guías ESMO
-- de acceso abierto o protocolos institucionales). NCCN requiere licencia.

create table public.guidelines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  organization text,
  version text,
  published_on date,
  license_note text,
  storage_path text not null,
  page_count integer,
  chunk_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  error text,
  active boolean not null default true,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.guideline_chunks (
  id bigint generated always as identity primary key,
  guideline_id uuid not null references public.guidelines(id) on delete cascade,
  page integer not null,
  chunk_index integer not null,
  content text not null,
  embedding extensions.vector(768) not null
);

create index guideline_chunks_guideline on public.guideline_chunks (guideline_id);
create index guideline_chunks_embedding on public.guideline_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- Búsqueda semántica: solo guías activas y procesadas. La llama la API.
create or replace function public.match_guideline_chunks(
  query_embedding extensions.vector(768),
  match_count integer default 6,
  min_similarity double precision default 0.5
)
returns table (
  chunk_id bigint,
  guideline_id uuid,
  title text,
  organization text,
  version text,
  page integer,
  content text,
  similarity double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select c.id, g.id, g.title, g.organization, g.version, c.page, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.guideline_chunks c
  join public.guidelines g on g.id = c.guideline_id
  where g.active and g.status = 'ready'
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

revoke execute on function public.match_guideline_chunks(extensions.vector, integer, double precision) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Permisos y RLS
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role, permission) values ('admin', 'guidelines:manage')
on conflict do nothing;

alter table public.ai_interactions enable row level security;
alter table public.document_extractions enable row level security;
alter table public.guidelines enable row level security;
alter table public.guideline_chunks enable row level security;

create policy ai_interactions_select on public.ai_interactions
  for select to authenticated
  using (public.has_permission('patients:read') and public.can_access_patient(patient_id));

create policy document_extractions_select on public.document_extractions
  for select to authenticated
  using (public.has_permission('patients:read') and public.can_access_patient(patient_id));

create policy guidelines_select on public.guidelines
  for select to authenticated
  using (public.has_permission('ai:use') or public.has_permission('guidelines:manage'));

-- guideline_chunks: sin políticas; solo la API (clave de servicio) los lee y escribe.

-- Bucket privado para los PDF de guías; lo maneja la API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guidelines', 'guidelines', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false;
