-- Gasol-IA · Fase 2: cuentas, rutas guardadas, suscripciones push y cola de avisos.
-- Auth compartido con otros productos del proyecto: todas las tablas cuelgan de
-- auth.users con ON DELETE CASCADE y RLS "cada usuario solo lo suyo".
-- El cliente no habla con PostgREST directamente: gasol-cuenta reenvía el JWT
-- del usuario, así que estas políticas son las que protegen cada fila.

-- Perfil mínimo ---------------------------------------------------------------
create table public.gasol_perfiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  alias          text check (alias is null or char_length(alias) between 1 and 40),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
comment on table public.gasol_perfiles is 'Perfil mínimo de Gasol-IA. Un usuario de Auth puede existir sin perfil (cuentas de otros productos).';

-- Rutas guardadas -------------------------------------------------------------
create table public.gasol_rutas (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre          text not null check (char_length(nombre) between 1 and 80),
  origen          jsonb not null,               -- {nombre, lat, lon}
  destino         jsonb not null,
  paradas         jsonb not null default '[]'::jsonb check (jsonb_typeof(paradas) = 'array' and jsonb_array_length(paradas) <= 3),
  combustible     text not null,
  solo_24h        boolean not null default false,
  lateral_km      numeric(4,1) not null default 2 check (lateral_km in (1, 2, 5, 10)),
  geometria       jsonb,                        -- polilínea simplificada [[lat,lon],...], solo para alertas
  distancia_km    numeric(7,1),
  duracion_min    integer,
  proveedor       text,
  alertas_activas boolean not null default false,
  creada_en       timestamptz not null default now(),
  actualizada_en  timestamptz not null default now()
);
comment on table public.gasol_rutas is 'Rutas que el usuario guarda. La geometría se guarda simplificada y solo para calcular avisos del corredor.';
create index gasol_rutas_usuario_idx on public.gasol_rutas (usuario_id);
create index gasol_rutas_alertas_idx on public.gasol_rutas (alertas_activas) where alertas_activas;

-- Suscripciones web push ------------------------------------------------------
create table public.gasol_push_suscripciones (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique check (endpoint like 'https://%'),
  p256dh     text not null,
  auth       text not null,
  creada_en  timestamptz not null default now()
);
create index gasol_push_usuario_idx on public.gasol_push_suscripciones (usuario_id);

-- Cola de avisos --------------------------------------------------------------
create table public.gasol_avisos (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  ruta_id    uuid not null references public.gasol_rutas (id) on delete cascade,
  captura_id bigint references public.gasol_capturas (id) on delete set null,
  titulo     text not null check (char_length(titulo) <= 60),
  cuerpo     text not null check (char_length(cuerpo) <= 160),
  estado     text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'sin_destino', 'error')),
  creado_en  timestamptz not null default now(),
  enviado_en timestamptz,
  unique (ruta_id, captura_id)                  -- un aviso por ruta y captura
);
create index gasol_avisos_usuario_idx on public.gasol_avisos (usuario_id);
create index gasol_avisos_pendientes_idx on public.gasol_avisos (estado) where estado = 'pendiente';

-- Uso diario (límite de cálculos de ruta por usuario; solo service_role) ---------
create table public.gasol_uso (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  dia        date not null default current_date,
  rutas      integer not null default 0,
  primary key (usuario_id, dia)
);

-- RLS -------------------------------------------------------------------------
alter table public.gasol_perfiles           enable row level security;
alter table public.gasol_rutas              enable row level security;
alter table public.gasol_push_suscripciones enable row level security;
alter table public.gasol_avisos             enable row level security;
alter table public.gasol_uso                enable row level security;

revoke all on public.gasol_perfiles, public.gasol_rutas, public.gasol_push_suscripciones,
              public.gasol_avisos, public.gasol_uso from anon, authenticated;

grant select, insert, delete on public.gasol_perfiles to authenticated;
grant update (alias, actualizado_en) on public.gasol_perfiles to authenticated;
grant select, insert, update, delete on public.gasol_rutas to authenticated;
grant select, insert, delete on public.gasol_push_suscripciones to authenticated;
grant select, delete on public.gasol_avisos to authenticated;

create policy gasol_perfiles_propio on public.gasol_perfiles
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy gasol_rutas_propias on public.gasol_rutas
  for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy gasol_push_propias on public.gasol_push_suscripciones
  for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy gasol_avisos_propios on public.gasol_avisos
  for all to authenticated
  using (usuario_id = (select auth.uid()));

-- Lugares para origen/destino: municipios con estaciones y su centroide --------
-- Evita un geocodificador externo: el usuario elige municipio de una lista.
create or replace function public.gasol_lugares()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_array(id_municipio, municipio, provincia, lat, lon)
                            order by municipio, provincia), '[]'::jsonb)
  from (
    select e.id_municipio, min(e.municipio) municipio, min(e.provincia) provincia,
           round(avg(e.lat)::numeric, 4) lat, round(avg(e.lon)::numeric, 4) lon
    from public.gasol_estaciones e
    group by e.id_municipio
  ) m;
$$;

-- Estaciones candidatas del corredor con precio actual y de la captura anterior.
-- p_cajas: [[lat_min, lat_max, lon_min, lon_max], ...] (tramos de la ruta).
-- Devuelve un único jsonb (sin el tope de 1000 filas de PostgREST).
create or replace function public.gasol_corredor_candidatas(
  p_cajas jsonb, p_combustible text, p_solo_24h boolean default false
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with cap as (
    select c.id, c.fecha_fuente, row_number() over (order by c.fecha_fuente desc, c.id desc) n
    from public.gasol_capturas c where c.estado = 'ok'
    order by c.fecha_fuente desc, c.id desc limit 2
  ),
  act as (select id, fecha_fuente from cap where n = 1),
  ant as (select id, fecha_fuente from cap where n = 2),
  cajas as (
    select (x->>0)::float8 lat_min, (x->>1)::float8 lat_max, (x->>2)::float8 lon_min, (x->>3)::float8 lon_max
    from jsonb_array_elements(p_cajas) x
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'ideess', e.ideess, 'rotulo', e.rotulo, 'direccion', e.direccion,
           'municipio', e.municipio, 'provincia', e.provincia, 'lat', e.lat, 'lon', e.lon,
           'horario_texto', e.horario_texto, 'abierta_24h', e.abierta_24h,
           'precio', p.precio, 'fecha_captura', p.fecha_captura,
           'precio_anterior', pa.precio, 'fecha_anterior', (select fecha_fuente from ant))), '[]'::jsonb)
  from public.gasol_estaciones e
  join public.gasol_precios p
    on p.ideess = e.ideess and p.combustible = p_combustible and p.captura_id = (select id from act)
  left join public.gasol_precios pa
    on pa.ideess = e.ideess and pa.combustible = p_combustible and pa.captura_id = (select id from ant)
  where (not p_solo_24h or e.abierta_24h = 'si')
    and exists (select 1 from cajas k
                where e.lat between k.lat_min and k.lat_max
                  and e.lon between k.lon_min and k.lon_max);
$$;

-- Cuenta un cálculo de ruta y dice si el usuario sigue dentro de su límite diario.
create or replace function public.gasol_uso_ruta(p_usuario uuid, p_limite integer)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  insert into public.gasol_uso as u (usuario_id, dia, rutas)
  values (p_usuario, current_date, 1)
  on conflict (usuario_id, dia) do update set rutas = u.rutas + 1
  returning rutas <= p_limite;
$$;

revoke execute on function public.gasol_lugares() from public, anon, authenticated;
revoke execute on function public.gasol_corredor_candidatas(jsonb, text, boolean) from public, anon, authenticated;
revoke execute on function public.gasol_uso_ruta(uuid, integer) from public, anon, authenticated;
grant execute on function public.gasol_lugares() to service_role;
grant execute on function public.gasol_corredor_candidatas(jsonb, text, boolean) to service_role;
grant execute on function public.gasol_uso_ruta(uuid, integer) to service_role;
