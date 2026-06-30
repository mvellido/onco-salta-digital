Para habilitar la carga de documentos en Supabase Storage:

1. En Supabase Dashboard, entra a Storage.
2. Crea un bucket llamado medical-history.
3. Define el bucket como público o usa signed URLs desde la app.
4. Asegúrate de que las políticas del bucket permitan upload/download para authenticated.
5. Ejemplo de política básica para uploads desde usuarios autenticados:

create policy "Allow authenticated uploads"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'medical-history');

create policy "Allow authenticated downloads"
on storage.objects
for select
to authenticated
using (bucket_id = 'medical-history');
