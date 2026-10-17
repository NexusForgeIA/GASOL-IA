-- Gasol-IA · Ingesta por lotes e idempotencia por huella.
-- (Aplicada en Supabase en tres pasos: gasol_lotes_1_huella_iniciar,
--  gasol_lotes_2_permisos, gasol_lotes_3_cerrar_fallida, más
--  gasol_comentario_ultima_captura. Este fichero es su suma.)
--
-- 1) El campo "Fecha" del JSON oficial es la hora de la respuesta (coincide con
--    la cabecera HTTP Date), no la de publicación: cada petición trae una Fecha
--    nueva. La idempotencia pasa a ser por huella (SHA-256 del contenido):
--    si coincide con la última captura ok, se registra como 'duplicada'.
-- 2) PostgREST corta cada sentencia a los 8 s (statement_timeout del rol
--    authenticator, compartido: no se toca). La carga se parte en llamadas
--    cortas. La web solo lee capturas en estado 'ok', así que una carga a medias
--    nunca sustituye a la última buena.
--
-- Sin DELETE ni DROP: el conector MCP no pudo confirmar sentencias destructivas.
-- La retención y la limpieza están en supabase/pendiente/ (requieren aplicarse a mano).

alter table public.gasol_capturas add column huella text;
comment on column public.gasol_capturas.fecha_fuente is
  'Campo "Fecha" del JSON oficial = hora de la respuesta del servicio. Es la fecha y hora de la captura que se muestra junto a cada precio.';
comment on column public.gasol_capturas.huella is
  'SHA-256 del contenido normalizado. Igual a la última captura ok = sin cambios.';
comment on column public.gasol_estaciones.ultima_captura_id is
  'En desuso desde la ingesta por lotes. Pendiente de eliminar.';

create or replace function public.gasol_ingestar(
  p_fuente text, p_fecha_fuente timestamptz, p_estaciones jsonb, p_precios jsonb,
  p_avisos jsonb default '[]'::jsonb, p_conservar integer default 14
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'gasol_ingestar está obsoleta: usar gasol_captura_iniciar / _cerrar';
end;
$$;

-- Inicia una captura o la marca como duplicada.
create or replace function public.gasol_captura_iniciar(
  p_fuente text, p_fecha_fuente timestamptz, p_huella text, p_avisos jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
  v_ultima text;
begin
  select c.huella into v_ultima from public.gasol_capturas c
   where c.estado = 'ok' order by c.fecha_fuente desc, c.id desc limit 1;

  -- Capturas que quedaron a medias (proceso cortado): se cierran como error.
  update public.gasol_capturas
     set estado = 'error', finalizada_en = clock_timestamp(),
         error = 'Carga interrumpida antes de cerrarse'
   where estado = 'en_curso' and iniciada_en < now() - interval '30 minutes';

  if v_ultima is not null and v_ultima = p_huella then
    insert into public.gasol_capturas (fuente, fecha_fuente, huella, estado, finalizada_en, avisos)
    values (p_fuente, p_fecha_fuente, p_huella, 'duplicada', clock_timestamp(), p_avisos)
    returning id into v_id;
    return jsonb_build_object('captura_id', v_id, 'estado', 'duplicada');
  end if;

  insert into public.gasol_capturas (fuente, fecha_fuente, huella, avisos)
  values (p_fuente, p_fecha_fuente, p_huella, p_avisos)
  returning id into v_id;
  return jsonb_build_object('captura_id', v_id, 'estado', 'en_curso');
end;
$$;

-- Upsert de un lote de estaciones; solo reescribe filas que cambian.
create or replace function public.gasol_estaciones_upsert(p_estaciones jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare v_n integer;
begin
  insert into public.gasol_estaciones as e (
    ideess, rotulo, direccion, cp, localidad, municipio, id_municipio,
    provincia, id_provincia, id_ccaa, lat, lon, margen, remision, tipo_venta,
    horario_texto, abierta_24h)
  select x.ideess, x.rotulo, x.direccion, x.cp, x.localidad, x.municipio, x.id_municipio,
         x.provincia, x.id_provincia, x.id_ccaa, x.lat, x.lon, x.margen, x.remision,
         x.tipo_venta, x.horario_texto, x.abierta_24h
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
    actualizada_en = now()
  where (e.rotulo, e.direccion, e.cp, e.localidad, e.municipio, e.id_municipio,
         e.provincia, e.id_provincia, e.id_ccaa, e.lat, e.lon, e.margen, e.remision,
         e.tipo_venta, e.horario_texto, e.abierta_24h)
    is distinct from
        (excluded.rotulo, excluded.direccion, excluded.cp, excluded.localidad,
         excluded.municipio, excluded.id_municipio, excluded.provincia,
         excluded.id_provincia, excluded.id_ccaa, excluded.lat, excluded.lon,
         excluded.margen, excluded.remision, excluded.tipo_venta,
         excluded.horario_texto, excluded.abierta_24h);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Inserta un lote de precios de una captura en curso.
create or replace function public.gasol_precios_insertar(p_captura_id bigint, p_precios jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fecha timestamptz;
  v_fuente text;
  v_n integer;
begin
  select c.fecha_fuente, c.fuente into v_fecha, v_fuente
    from public.gasol_capturas c where c.id = p_captura_id and c.estado = 'en_curso';
  if not found then raise exception 'Captura % no está en curso', p_captura_id; end if;

  insert into public.gasol_precios (captura_id, ideess, combustible, precio, fecha_captura, fuente)
  select p_captura_id, x.ideess, x.combustible, x.precio, v_fecha, v_fuente
  from jsonb_to_recordset(p_precios) as x(ideess text, combustible text, precio numeric);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Cierra la captura como ok solo si están todos los precios esperados.
create or replace function public.gasol_captura_cerrar(
  p_captura_id bigint, p_n_estaciones integer, p_n_precios integer
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare v_n integer;
begin
  select count(*) into v_n from public.gasol_precios where captura_id = p_captura_id;
  if v_n <> p_n_precios then
    raise exception 'Captura %: % precios cargados, se esperaban %', p_captura_id, v_n, p_n_precios;
  end if;

  update public.gasol_capturas
     set estado = 'ok', finalizada_en = clock_timestamp(),
         n_estaciones = p_n_estaciones, n_precios = v_n
   where id = p_captura_id and estado = 'en_curso';
  if not found then raise exception 'Captura % no está en curso', p_captura_id; end if;

  return jsonb_build_object('captura_id', p_captura_id, 'estado', 'ok',
                            'n_estaciones', p_n_estaciones, 'n_precios', v_n);
end;
$$;

-- Los precios parciales de una captura fallida no se borran aquí: la vista
-- gasol_precios_actuales solo lee capturas 'ok', así que nunca se muestran.
create or replace function public.gasol_captura_fallida(p_captura_id bigint, p_error text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.gasol_capturas
     set estado = 'error', finalizada_en = clock_timestamp(), error = left(p_error, 1000)
   where id = p_captura_id and estado = 'en_curso';
$$;

-- Registra un fallo sin captura iniciada (p. ej. la fuente no respondió).
create or replace function public.gasol_captura_error(p_fuente text, p_error text)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.gasol_capturas (fuente, estado, finalizada_en, error)
  values (p_fuente, 'error', clock_timestamp(), left(p_error, 1000));
$$;

revoke execute on function public.gasol_captura_iniciar(text, timestamptz, text, jsonb) from public, anon, authenticated;
revoke execute on function public.gasol_estaciones_upsert(jsonb) from public, anon, authenticated;
revoke execute on function public.gasol_precios_insertar(bigint, jsonb) from public, anon, authenticated;
revoke execute on function public.gasol_captura_cerrar(bigint, integer, integer) from public, anon, authenticated;
revoke execute on function public.gasol_captura_fallida(bigint, text) from public, anon, authenticated;
revoke execute on function public.gasol_captura_error(text, text) from public, anon, authenticated;
grant execute on function public.gasol_captura_iniciar(text, timestamptz, text, jsonb) to service_role;
grant execute on function public.gasol_estaciones_upsert(jsonb) to service_role;
grant execute on function public.gasol_precios_insertar(bigint, jsonb) to service_role;
grant execute on function public.gasol_captura_cerrar(bigint, integer, integer) to service_role;
grant execute on function public.gasol_captura_fallida(bigint, text) to service_role;
grant execute on function public.gasol_captura_error(text, text) to service_role;
