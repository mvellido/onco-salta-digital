-- Perfiles para los usuarios que ya existían antes de instalar el esquema
-- (el trigger de invitaciones solo actúa sobre usuarios nuevos).
-- El dueño del proyecto queda como administrador; el resto, sin rol e inactivo
-- hasta que el administrador lo habilite desde Configuración.

insert into public.profiles (id, email, role, active)
select id, email, 'admin', true
from auth.users
where lower(email) = 'mvellido@gmail.com'
on conflict (id) do update set role = 'admin', active = true;

insert into public.profiles (id, email, role, active)
select id, email, null, false
from auth.users
on conflict (id) do nothing;
