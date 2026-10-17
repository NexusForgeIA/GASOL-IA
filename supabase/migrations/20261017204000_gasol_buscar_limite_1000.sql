-- Gasol-IA · gasol_buscar admite hasta 1000 filas (la provincia más grande,
-- Madrid, tiene ~900 estaciones; 1000 es también el max-rows de PostgREST).
-- Lo usa el generador de páginas estáticas para pedir una provincia de una vez.

create or replace function public.gasol_buscar(
  p_combustible text,
  p_id_provincia text default null,
  p_id_municipio text default null,
  p_lat double precision default null,
  p_lon double precision default null,
  p_radio_km double precision default 10,
  p_solo_24h boolean default false,
  p_limite integer default 200
) returns table (
  ideess text, rotulo text, direccion text, localidad text, municipio text,
  id_municipio text, provincia text, id_provincia text, lat double precision,
  lon double precision, horario_texto text, abierta_24h text, combustible text,
  precio numeric, fecha_captura timestamptz, fuente text, distancia_km double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with cerca as (
    select p_radio_km / 111.32 as dlat,
           p_radio_km / (111.32 * greatest(cos(radians(p_lat)), 0.01)) as dlon
  )
  select e.ideess, e.rotulo, e.direccion, e.localidad, e.municipio, e.id_municipio,
         e.provincia, e.id_provincia, e.lat, e.lon, e.horario_texto, e.abierta_24h,
         a.combustible, a.precio, a.fecha_captura, a.fuente, d.km
  from public.gasol_precios_actuales a
  join public.gasol_estaciones e on e.ideess = a.ideess
  cross join cerca
  cross join lateral (
    select case when p_lat is null or p_lon is null then null else
      2 * 6371 * asin(sqrt(
        power(sin(radians(e.lat - p_lat) / 2), 2) +
        cos(radians(p_lat)) * cos(radians(e.lat)) *
        power(sin(radians(e.lon - p_lon) / 2), 2)))
    end as km
  ) d
  where a.combustible = p_combustible
    and (p_id_provincia is null or e.id_provincia = p_id_provincia)
    and (p_id_municipio is null or e.id_municipio = p_id_municipio)
    and (p_lat is null or p_lon is null or (
          e.lat between p_lat - cerca.dlat and p_lat + cerca.dlat
      and e.lon between p_lon - cerca.dlon and p_lon + cerca.dlon
      and d.km <= p_radio_km))
    and (not p_solo_24h or e.abierta_24h = 'si')
  order by a.precio asc, d.km asc nulls last, e.ideess
  limit least(greatest(p_limite, 1), 1000);
$$;
