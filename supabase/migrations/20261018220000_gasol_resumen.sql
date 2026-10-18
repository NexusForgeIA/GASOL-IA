-- Resumen diario por Telegram (gasol-resumen). Solo datos agregados.

-- 1) Clave del cron en Vault, generada dentro de la base: nunca aparece en claro.
select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'gasol_resumen_clave', 'Clave del cron de gasol-resumen');

create or replace function public.gasol_resumen_clave_valida(p_clave text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select s.decrypted_secret = p_clave from vault.decrypted_secrets s
                    where s.name = 'gasol_resumen_clave' limit 1), false);
$$;
revoke all on function public.gasol_resumen_clave_valida(text) from public, anon, authenticated;
grant execute on function public.gasol_resumen_clave_valida(text) to service_role;

-- 2) Datos de un día (Madrid): aperturas por página y modo, horas con el tope alcanzado y
--    cálculos de ruta del día (null si no hay fila).
create or replace function public.gasol_datos_resumen(p_dia date, p_limite_hora integer)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  with h as (
    select recuento from public.gasol_visitas_hora
     where hora >= (p_dia::timestamp at time zone 'Europe/Madrid')
       and hora <  ((p_dia + 1)::timestamp at time zone 'Europe/Madrid'))
  select jsonb_build_object(
    'visitas', coalesce((select jsonb_agg(jsonb_build_object('pagina', pagina, 'modo', modo, 'recuento', recuento))
                           from public.gasol_visitas where dia = p_dia), '[]'::jsonb),
    'horas_tope', (select count(*) from h where recuento > p_limite_hora),
    'rutas', (select calculos from public.gasol_uso_ruta
               where ventana = 'dia' and inicio = (p_dia::timestamp at time zone 'Europe/Madrid')));
$$;
revoke all on function public.gasol_datos_resumen(date, integer) from public, anon, authenticated;
grant execute on function public.gasol_datos_resumen(date, integer) to service_role;

-- 3) A las 08:00 de Madrid. pg_cron va en UTC: se programa a las 06:00 y a las 07:00 UTC y solo
--    envía cuando en Madrid son las 8 (verano UTC+2, invierno UTC+1). La clave se lee de Vault.
create or replace function public.gasol_lanzar_resumen()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if extract(hour from now() at time zone 'Europe/Madrid') <> 8 then return; end if;
  perform net.http_post(
    url := 'https://mlaqtniujnvfxcvcourm.supabase.co/functions/v1/gasol-resumen',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-gasol-clave', (select decrypted_secret from vault.decrypted_secrets
                         where name = 'gasol_resumen_clave' limit 1)),
    body := '{}'::jsonb, timeout_milliseconds := 30000);
end;
$$;
revoke all on function public.gasol_lanzar_resumen() from public, anon, authenticated;

select cron.schedule('gasol-resumen-diario', '0 6,7 * * *', $cron$ select public.gasol_lanzar_resumen(); $cron$);
