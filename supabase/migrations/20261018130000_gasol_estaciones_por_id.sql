-- Favoritas (solo en el navegador): último precio de una lista de estaciones por su ID.
-- Mismas columnas y misma lógica de horario (abierta_24h) que gasol_buscar. Las estaciones sin
-- ese combustible vuelven con precio null. Solo lectura; solo service_role (vía gasol-buscar).
create or replace function public.gasol_estaciones_por_id(p_ids text[], p_combustible text)
returns table(ideess text, rotulo text, direccion text, localidad text, municipio text, id_municipio text,
              provincia text, id_provincia text, lat double precision, lon double precision,
              horario_texto text, abierta_24h text, combustible text, precio numeric,
              fecha_captura timestamp with time zone, fuente text)
language sql
stable
security invoker
set search_path to ''
as $$
  select e.ideess, e.rotulo, e.direccion, e.localidad, e.municipio, e.id_municipio,
         e.provincia, e.id_provincia, e.lat, e.lon, e.horario_texto, e.abierta_24h,
         p_combustible, a.precio, a.fecha_captura, a.fuente
  from public.gasol_estaciones e
  left join public.gasol_precios_actuales a
    on a.ideess = e.ideess and a.combustible = p_combustible
  where e.ideess = any (p_ids[1:50])
  order by e.ideess;
$$;

revoke all on function public.gasol_estaciones_por_id(text[], text) from public, anon, authenticated;
grant execute on function public.gasol_estaciones_por_id(text[], text) to service_role;
