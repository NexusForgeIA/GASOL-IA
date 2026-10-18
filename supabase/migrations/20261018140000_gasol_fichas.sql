-- Ficha de estación: datos completos y precios de la última captura de una lista de estaciones.
-- p_combustibles es la lista de productos que la web muestra (la decide gasol-buscar); sin
-- precio en la captura, el producto no sale. Solo lectura; solo service_role (vía gasol-buscar).
create or replace function public.gasol_fichas(p_ids text[], p_combustibles text[])
returns table(ideess text, rotulo text, direccion text, cp text, localidad text, municipio text,
              provincia text, lat double precision, lon double precision, horario_texto text,
              abierta_24h text, precios jsonb)
language sql
stable
security invoker
set search_path to ''
as $$
  select e.ideess, e.rotulo, e.direccion, e.cp, e.localidad, e.municipio, e.provincia, e.lat, e.lon,
         e.horario_texto, e.abierta_24h,
         coalesce((select jsonb_agg(jsonb_build_object(
                     'combustible', a.combustible, 'precio', a.precio,
                     'fecha_captura', a.fecha_captura, 'fuente', a.fuente)
                     order by array_position(p_combustibles, a.combustible))
                   from public.gasol_precios_actuales a
                   where a.ideess = e.ideess and a.combustible = any (p_combustibles)), '[]'::jsonb)
  from public.gasol_estaciones e
  where e.ideess = any (p_ids[1:50])
  order by e.ideess;
$$;

revoke all on function public.gasol_fichas(text[], text[]) from public, anon, authenticated;
grant execute on function public.gasol_fichas(text[], text[]) to service_role;
