-- Gasol-IA · Lectura de secretos de Vault para las Edge Functions.
-- Los valores se crean fuera del repo (nunca se commitean):
--   select vault.create_secret('<pública>', 'gasol_vapid_publica', ...);
--   select vault.create_secret('<privada>', 'gasol_vapid_privada', ...);
-- Lista blanca de nombres: la función no sirve para leer otros secretos del proyecto.

create or replace function public.gasol_secreto(p_nombre text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from vault.decrypted_secrets s
  where s.name = p_nombre
    and p_nombre in ('gasol_vapid_publica', 'gasol_vapid_privada')
  limit 1;
$$;
revoke execute on function public.gasol_secreto(text) from public, anon, authenticated;
grant execute on function public.gasol_secreto(text) to service_role;
