-- Tope global de cálculos de ruta por hora y por día (protege al servidor de demostración de OSRM).
-- Solo contadores agregados: tipo de ventana, inicio de la ventana y número.
-- Sin IP, sin coordenadas, sin identificadores.
create table public.gasol_uso_ruta (
  ventana  text        not null check (ventana in ('hora', 'dia')),
  inicio   timestamptz not null,
  calculos integer     not null default 0 check (calculos >= 0),
  primary key (ventana, inicio)
);
comment on table public.gasol_uso_ruta is
  'Cálculos de ruta por hora y por día entre todos (sin IP, coordenadas ni usuarios).';
alter table public.gasol_uso_ruta enable row level security;
revoke all on public.gasol_uso_ruta from anon, authenticated;

-- Suma 1 a la hora y al día en curso (día de Madrid) y dice si se puede calcular.
-- Devuelve 'ok', 'hora' o 'dia'. Al abrir un día nuevo borra las ventanas de más de 35 días.
create or replace function public.gasol_contar_ruta(p_limite_hora integer, p_limite_dia integer)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  h integer;
  d integer;
begin
  insert into public.gasol_uso_ruta as u (ventana, inicio, calculos)
  values ('hora', date_trunc('hour', now()), 1)
  on conflict (ventana, inicio) do update set calculos = u.calculos + 1
  returning calculos into h;

  insert into public.gasol_uso_ruta as u (ventana, inicio, calculos)
  values ('dia', date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid', 1)
  on conflict (ventana, inicio) do update set calculos = u.calculos + 1
  returning calculos into d;

  if d = 1 then
    delete from public.gasol_uso_ruta where inicio < now() - interval '35 days';
  end if;

  if d > p_limite_dia then return 'dia'; end if;
  if h > p_limite_hora then return 'hora'; end if;
  return 'ok';
end;
$$;
revoke execute on function public.gasol_contar_ruta(integer, integer) from public, anon, authenticated;
grant execute on function public.gasol_contar_ruta(integer, integer) to service_role;
