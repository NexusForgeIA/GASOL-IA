-- Gasol-IA · Programación diaria de gasol-ingest.
-- El token vive en Vault con el nombre 'gasol_ingest_token'. Se crea una sola vez
-- fuera del repo (nunca se commitea):
--   select vault.create_secret('<token>', 'gasol_ingest_token', 'Token de gasol-ingest');

-- La Edge Function comprueba el token contra Vault con esta función.
create or replace function public.gasol_token_valido(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.decrypted_secret = p_token
       from vault.decrypted_secrets s
      where s.name = 'gasol_ingest_token'
      limit 1),
    false);
$$;
revoke all on function public.gasol_token_valido(text) from public, anon, authenticated;
grant execute on function public.gasol_token_valido(text) to service_role;

-- Una vez al día, 04:15 UTC (06:15 en verano / 05:15 en invierno, hora peninsular).
select cron.schedule(
  'gasol-ingest-diario',
  '15 4 * * *',
  $cron$
  select net.http_post(
    url := 'https://mlaqtniujnvfxcvcourm.supabase.co/functions/v1/gasol-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-gasol-token', (select decrypted_secret from vault.decrypted_secrets
                        where name = 'gasol_ingest_token' limit 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $cron$
);
