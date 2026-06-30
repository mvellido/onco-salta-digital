Pasos para habilitar la autenticación real de médicos:

1. En Supabase Dashboard, habilita Authentication > Providers > Email.
2. En Authentication > URL Configuration, define Site URL y redirect URLs para tu frontend local.
3. En la tabla patients, asegúrate de que la política RLS permita seleccionar/insertar usando auth.uid() = assigned_doctor_id.
4. Si deseas limitar el registro a invitaciones, define VITE_DOCTOR_INVITE_CODE en tu .env.local.
5. Para pruebas locales, crea un usuario médico en la UI y luego usa su email/contraseña para entrar.
