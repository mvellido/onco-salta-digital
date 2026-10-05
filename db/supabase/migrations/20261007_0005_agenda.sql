-- Onco-Salta Digital · Agenda por profesional (Etapa 4a)
-- Turnos con profesional, duración, tipo y recurso (consultorio o sillón de
-- quimioterapia). Horarios de atención por profesional.

alter table public.appointments
  add column professional_id uuid references public.profiles(id),
  add column duration_minutes smallint not null default 30 check (duration_minutes between 5 and 480),
  add column kind text not null default 'consulta' check (kind in (
    'primera_vez', 'consulta', 'control', 'quimioterapia', 'radioterapia', 'estudio', 'procedimiento', 'otro'
  )),
  add column resource text,
  add column is_overbook boolean not null default false,
  add constraint appointments_time_format check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

create index appointments_professional_date on public.appointments (professional_id, date);
create index appointments_resource_date on public.appointments (resource, date) where resource is not null;

-- Horario de atención semanal. weekday: 1 = lunes … 7 = domingo (ISO).
create table public.professional_schedules (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  slot_minutes smallint not null default 30 check (slot_minutes between 5 and 240),
  resource text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index professional_schedules_professional on public.professional_schedules (professional_id, weekday);

alter table public.professional_schedules enable row level security;
-- Sin políticas para el navegador: la agenda se maneja por la API.
