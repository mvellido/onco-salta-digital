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
