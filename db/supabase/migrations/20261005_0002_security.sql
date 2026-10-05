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

revoke execute on function public.handle_new_user() from public, anon, authenticated;

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
