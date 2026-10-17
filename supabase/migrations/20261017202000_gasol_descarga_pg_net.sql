-- Gasol-IA · Descarga del JSON oficial a través de pg_net.
--
-- Motivo: sedeaplicaciones.minetur.gob.es solo negocia TLS 1.2 con intercambio
-- de claves RSA estático (AES256-GCM-SHA384). El runtime de Edge Functions
-- (Deno/rustls) no soporta ese cifrado y la conexión se corta en el handshake.
-- pg_net (libcurl/OpenSSL) sí conecta. gasol-ingest pide la descarga con
-- gasol_descargar() y recoge el cuerpo con gasol_descarga_resultado().
--
-- URL fija dentro de la función: no se acepta ninguna URL externa (sin SSRF).

create or replace function public.gasol_descargar()
returns bigint
language sql
volatile
security definer
set search_path = ''
as $$
  select net.http_get(
    url := 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/',
    headers := '{"Accept": "application/json"}'::jsonb,
    timeout_milliseconds := 120000
  );
$$;
revoke all on function public.gasol_descargar() from public, anon, authenticated;
grant execute on function public.gasol_descargar() to service_role;

-- Devuelve 0 filas mientras pg_net no haya terminado.
create or replace function public.gasol_descarga_resultado(p_id bigint)
returns table (status_code integer, timed_out boolean, error_msg text, content text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.status_code, r.timed_out, r.error_msg, r.content
  from net._http_response r
  where r.id = p_id;
$$;
revoke all on function public.gasol_descarga_resultado(bigint) from public, anon, authenticated;
grant execute on function public.gasol_descarga_resultado(bigint) to service_role;
