-- Gasol-IA · Fase 1: estaciones, precios y log de capturas.
-- Solo crea objetos gasol_*. No toca nada existente del proyecto.
-- Acceso: todo pasa por las Edge Functions gasol-* con service_role.
-- RLS activado sin políticas = invisible para anon/authenticated.

-- 1. Log de capturas ---------------------------------------------------------
create table public.gasol_capturas (
  id            bigint generated always as identity primary key,
  fuente        text        not null,
  fecha_fuente  timestamptz,                -- campo "Fecha" del JSON oficial
  iniciada_en   timestamptz not null default now(),
  finalizada_en timestamptz,
  estado        text        not null default 'en_curso'
                check (estado in ('en_curso', 'ok', 'error', 'duplicada')),
  n_estaciones  integer,
  n_precios     integer,
  error         text,
  avisos        jsonb       not null default '[]'::jsonb
);
comment on table public.gasol_capturas is
  'Log de cada carga del servicio oficial de carburantes. Solo la última con estado ok alimenta la web.';
-- Idempotencia: una misma publicación oficial solo se carga una vez.
create unique index gasol_capturas_fecha_ok_uq
  on public.gasol_capturas (fecha_fuente) where estado = 'ok';
create index gasol_capturas_estado_idx on public.gasol_capturas (estado, fecha_fuente desc);

-- 2. Estaciones -------------------------------------------------------------
create table public.gasol_estaciones (
  ideess          text primary key,
  rotulo          text not null default '',
  direccion       text not null default '',
  cp              text not null default '',
  localidad       text not null default '',
  municipio       text not null default '',
  id_municipio    text not null,
  provincia       text not null default '',
  id_provincia    text not null,
  id_ccaa         text not null default '',
  lat             double precision not null check (lat between -90 and 90),
  lon             double precision not null check (lon between -180 and 180),
  margen          text not null default '',
  remision        text not null default '',
  tipo_venta      text not null default '',
  horario_texto   text not null default '',   -- siempre el texto original
  abierta_24h     text not null default 'sin_confirmar'
                  check (abierta_24h in ('si', 'no', 'sin_confirmar')),
  ultima_captura_id bigint references public.gasol_capturas (id) on delete set null,
  actualizada_en  timestamptz not null default now()
);
comment on table public.gasol_estaciones is
  'Estaciones terrestres del servicio oficial (MITECO). abierta_24h la calcula gasol-ingest a partir de horario_texto.';
create index gasol_estaciones_provincia_idx on public.gasol_estaciones (id_provincia);
create index gasol_estaciones_municipio_idx on public.gasol_estaciones (id_municipio);
create index gasol_estaciones_latlon_idx    on public.gasol_estaciones (lat, lon);
create index gasol_estaciones_captura_idx   on public.gasol_estaciones (ultima_captura_id);

-- 3. Precios (uno por estación, combustible y captura) -----------------------
create table public.gasol_precios (
  captura_id    bigint      not null references public.gasol_capturas (id) on delete cascade,
  ideess        text        not null references public.gasol_estaciones (ideess) on delete cascade,
  combustible   text        not null,
  precio        numeric(7,3) not null check (precio > 0),
  fecha_captura timestamptz not null,   -- = fecha_fuente de la captura
  fuente        text        not null,
  primary key (captura_id, combustible, ideess)
);
comment on table public.gasol_precios is
  'Precio publicado por la fuente oficial en fecha_captura. Se conservan las últimas capturas ok (ver gasol_ingestar).';
create index gasol_precios_ideess_idx on public.gasol_precios (ideess);

-- 4. RLS: activado, sin políticas ------------------------------------------
alter table public.gasol_capturas   enable row level security;
alter table public.gasol_estaciones enable row level security;
alter table public.gasol_precios    enable row level security;
revoke all on public.gasol_capturas, public.gasol_estaciones, public.gasol_precios
  from anon, authenticated;

-- 5. Vista de precios vigentes (última captura ok) --------------------------
create view public.gasol_precios_actuales
with (security_invoker = on) as
select p.ideess, p.combustible, p.precio, p.fecha_captura, p.fuente, p.captura_id
from public.gasol_precios p
where p.captura_id = (
  select c.id from public.gasol_capturas c
  where c.estado = 'ok'
  order by c.fecha_fuente desc, c.id desc
  limit 1
);
revoke all on public.gasol_precios_actuales from anon, authenticated;

-- 6. Ingesta atómica ---------------------------------------------------------
-- Todo o nada: si algo falla, la transacción se deshace y la última captura
-- ok sigue siendo la vigente. Solo service_role puede ejecutarla.
create or replace function public.gasol_ingestar(
  p_fuente       text,
  p_fecha_fuente timestamptz,
  p_estaciones   jsonb,
  p_precios      jsonb,
  p_avisos       jsonb default '[]'::jsonb,
  p_conservar    integer default 14
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
  v_n_est integer;
  v_n_pre integer;
begin
  if exists (select 1 from public.gasol_capturas
             where estado = 'ok' and fecha_fuente = p_fecha_fuente) then
    insert into public.gasol_capturas (fuente, fecha_fuente, estado, finalizada_en, avisos)
    values (p_fuente, p_fecha_fuente, 'duplicada', now(), p_avisos)
    returning id into v_id;
    return jsonb_build_object('captura_id', v_id, 'estado', 'duplicada');
  end if;

  insert into public.gasol_capturas (fuente, fecha_fuente, avisos)
  values (p_fuente, p_fecha_fuente, p_avisos)
  returning id into v_id;

  insert into public.gasol_estaciones as e (
    ideess, rotulo, direccion, cp, localidad, municipio, id_municipio,
    provincia, id_provincia, id_ccaa, lat, lon, margen, remision, tipo_venta,
    horario_texto, abierta_24h, ultima_captura_id, actualizada_en)
  select x.ideess, x.rotulo, x.direccion, x.cp, x.localidad, x.municipio, x.id_municipio,
         x.provincia, x.id_provincia, x.id_ccaa, x.lat, x.lon, x.margen, x.remision,
         x.tipo_venta, x.horario_texto, x.abierta_24h, v_id, now()
  from jsonb_to_recordset(p_estaciones) as x(
    ideess text, rotulo text, direccion text, cp text, localidad text, municipio text,
    id_municipio text, provincia text, id_provincia text, id_ccaa text,
    lat double precision, lon double precision, margen text, remision text,
    tipo_venta text, horario_texto text, abierta_24h text)
  on conflict (ideess) do update set
    rotulo = excluded.rotulo, direccion = excluded.direccion, cp = excluded.cp,
    localidad = excluded.localidad, municipio = excluded.municipio,
    id_municipio = excluded.id_municipio, provincia = excluded.provincia,
    id_provincia = excluded.id_provincia, id_ccaa = excluded.id_ccaa,
    lat = excluded.lat, lon = excluded.lon, margen = excluded.margen,
    remision = excluded.remision, tipo_venta = excluded.tipo_venta,
    horario_texto = excluded.horario_texto, abierta_24h = excluded.abierta_24h,
    ultima_captura_id = excluded.ultima_captura_id, actualizada_en = excluded.actualizada_en;
  get diagnostics v_n_est = row_count;

  insert into public.gasol_precios (captura_id, ideess, combustible, precio, fecha_captura, fuente)
  select v_id, x.ideess, x.combustible, x.precio, p_fecha_fuente, p_fuente
  from jsonb_to_recordset(p_precios) as x(ideess text, combustible text, precio numeric);
  get diagnostics v_n_pre = row_count;

  update public.gasol_capturas
     set estado = 'ok', finalizada_en = now(), n_estaciones = v_n_est, n_precios = v_n_pre
   where id = v_id;

  -- Retención: se conservan las últimas p_conservar capturas ok con sus precios.
  delete from public.gasol_capturas c
   where c.estado = 'ok'
     and c.id not in (select id from public.gasol_capturas
                      where estado = 'ok'
                      order by fecha_fuente desc, id desc
                      limit greatest(p_conservar, 1));

  return jsonb_build_object('captura_id', v_id, 'estado', 'ok',
                            'n_estaciones', v_n_est, 'n_precios', v_n_pre);
end;
$$;
revoke all on function public.gasol_ingestar(text, timestamptz, jsonb, jsonb, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.gasol_ingestar(text, timestamptz, jsonb, jsonb, jsonb, integer)
  to service_role;

-- 7. Búsqueda para la web ----------------------------------------------------
-- provincia | municipio | cerca (lat, lon, radio). Ordena por precio ascendente.
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
  limit least(greatest(p_limite, 1), 500);
$$;
revoke all on function public.gasol_buscar(text, text, text, double precision, double precision, double precision, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.gasol_buscar(text, text, text, double precision, double precision, double precision, boolean, integer)
  to service_role;

-- Listado de provincias y municipios con estaciones (para los selectores).
create or replace function public.gasol_territorios()
returns table (id_provincia text, provincia text, id_municipio text, municipio text, n integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.id_provincia, min(e.provincia), e.id_municipio, min(e.municipio), count(*)::integer
  from public.gasol_estaciones e
  group by e.id_provincia, e.id_municipio
  order by 2, 4;
$$;
revoke all on function public.gasol_territorios() from public, anon, authenticated;
grant execute on function public.gasol_territorios() to service_role;
