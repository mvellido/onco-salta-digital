alter table public.patients enable row level security;
alter table public.treatments enable row level security;
alter table public.tumors enable row level security;
alter table public.clinical_documents enable row level security;
alter table public.appointments enable row level security;
alter table public.billing_records enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists patients_select_own on public.patients;
create policy patients_select_own on public.patients
for select
using (auth.uid() = assigned_doctor_id);

drop policy if exists patients_insert_own on public.patients;
create policy patients_insert_own on public.patients
for insert
with check (auth.uid() = assigned_doctor_id);

drop policy if exists patients_update_own on public.patients;
create policy patients_update_own on public.patients
for update
using (auth.uid() = assigned_doctor_id)
with check (auth.uid() = assigned_doctor_id);

create or replace function public.can_access_patient(target_patient_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.patients p
    where p.id = target_patient_id
      and p.assigned_doctor_id = auth.uid()
  );
$$;

drop policy if exists treatments_crud_by_patient_owner on public.treatments;
create policy treatments_crud_by_patient_owner on public.treatments
for all
using (public.can_access_patient(patient_id))
with check (public.can_access_patient(patient_id));

drop policy if exists tumors_crud_by_patient_owner on public.tumors;
create policy tumors_crud_by_patient_owner on public.tumors
for all
using (public.can_access_patient(patient_id))
with check (public.can_access_patient(patient_id));

drop policy if exists documents_crud_by_patient_owner on public.clinical_documents;
create policy documents_crud_by_patient_owner on public.clinical_documents
for all
using (public.can_access_patient(patient_id))
with check (public.can_access_patient(patient_id));

drop policy if exists appointments_crud_by_patient_owner on public.appointments;
create policy appointments_crud_by_patient_owner on public.appointments
for all
using (public.can_access_patient(patient_id))
with check (public.can_access_patient(patient_id));

drop policy if exists billing_crud_by_patient_owner on public.billing_records;
create policy billing_crud_by_patient_owner on public.billing_records
for all
using (public.can_access_patient(patient_id))
with check (public.can_access_patient(patient_id));

drop policy if exists user_roles_select_self on public.user_roles;
create policy user_roles_select_self on public.user_roles
for select
using (auth.uid() = user_id);

drop policy if exists audit_insert_authenticated on public.audit_logs;
create policy audit_insert_authenticated on public.audit_logs
for insert
with check (auth.uid() is not null);

drop policy if exists audit_select_self on public.audit_logs;
create policy audit_select_self on public.audit_logs
for select
using (auth.uid() = actor_id);
