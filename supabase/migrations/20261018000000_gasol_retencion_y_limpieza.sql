-- Gasol-IA · Retención de capturas (14) y limpieza de restos de la primera ingesta.
-- Aplicada el 2026-10-17 desde el SQL Editor de Supabase (confirmación humana).
-- Afecta solo a objetos gasol_*.

-- 1. Retención: conservar las últimas 14 capturas ok (y sus precios, por cascada)
--    y borrar los precios huérfanos de capturas fallidas.
create or replace function public.gasol_retencion(p_conservar integer default 14)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare v_capturas integer; v_huerfanos integer;
begin
  delete from public.gasol_precios p
   using public.gasol_capturas c
   where c.id = p.captura_id and c.estado = 'error';
  get diagnostics v_huerfanos = row_count;

  delete from public.gasol_capturas c
   where c.estado = 'ok'
     and c.id not in (select id from public.gasol_capturas
                      where estado = 'ok'
                      order by fecha_fuente desc, id desc
                      limit greatest(p_conservar, 1));
  get diagnostics v_capturas = row_count;

  return jsonb_build_object('capturas_borradas', v_capturas, 'precios_huerfanos', v_huerfanos);
end;
$$;
revoke execute on function public.gasol_retencion(integer) from public, anon, authenticated;
grant execute on function public.gasol_retencion(integer) to service_role;

-- Una vez al día, después de la ingesta.
select cron.schedule('gasol-retencion-diaria', '45 4 * * *',
  $cron$ select public.gasol_retencion(14); $cron$);

-- 2. Limpieza de restos de la primera versión de la ingesta.
drop function if exists public.gasol_ingestar(text, timestamptz, jsonb, jsonb, jsonb, integer);
drop index if exists public.gasol_capturas_fecha_ok_uq;
alter table public.gasol_estaciones drop column if exists ultima_captura_id;
