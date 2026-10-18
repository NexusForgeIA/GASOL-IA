-- Aperturas de la app por día, página y modo. Se cuentan aperturas, no personas.
-- Sin IP, sin coordenadas, sin identificadores.
create table public.gasol_visitas (
  dia      date    not null,
  pagina   text    not null check (pagina in ('portada','inicio','comparador','ruta','calculadoras','favoritas',
                                              'gastos','ingresos','vencimientos','cuenta','privacidad','aviso-legal','instalar')),
  modo     text    not null check (modo in ('navegador', 'instalada')),
  recuento integer not null default 0 check (recuento >= 0),
  primary key (dia, pagina, modo)
);
comment on table public.gasol_visitas is 'Aperturas por día (Madrid), página y modo. Aperturas, no personas; sin IP ni identificadores.';
alter table public.gasol_visitas enable row level security;
revoke all on public.gasol_visitas from anon, authenticated;

-- Tope global por hora (que nadie pueda inflar el contador). Solo hora y número.
create table public.gasol_visitas_hora (
  hora     timestamptz primary key,
  recuento integer not null default 0 check (recuento >= 0)
);
comment on table public.gasol_visitas_hora is 'Aperturas por hora entre todos, para el tope (sin IP ni identificadores).';
alter table public.gasol_visitas_hora enable row level security;
revoke all on public.gasol_visitas_hora from anon, authenticated;

-- Suma 1 a la apertura. Devuelve 'ok', 'tope' (hora llena: no se cuenta) o 'invalida'.
-- Al empezar una hora nueva borra las horas de más de 2 días.
create or replace function public.gasol_contar_visita(p_pagina text, p_modo text, p_limite_hora integer)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  h integer;
begin
  if p_pagina is null or p_pagina not in ('portada','inicio','comparador','ruta','calculadoras','favoritas',
      'gastos','ingresos','vencimientos','cuenta','privacidad','aviso-legal','instalar')
     or p_modo is null or p_modo not in ('navegador', 'instalada') then
    return 'invalida';
  end if;

  insert into public.gasol_visitas_hora as v (hora, recuento)
  values (date_trunc('hour', now()), 1)
  on conflict (hora) do update set recuento = v.recuento + 1
  returning recuento into h;
  if h = 1 then
    delete from public.gasol_visitas_hora where hora < now() - interval '2 days';
  end if;
  if h > p_limite_hora then return 'tope'; end if;

  insert into public.gasol_visitas as v (dia, pagina, modo, recuento)
  values ((now() at time zone 'Europe/Madrid')::date, p_pagina, p_modo, 1)
  on conflict (dia, pagina, modo) do update set recuento = v.recuento + 1;
  return 'ok';
end;
$$;
revoke execute on function public.gasol_contar_visita(text, text, integer) from public, anon, authenticated;
grant execute on function public.gasol_contar_visita(text, text, integer) to service_role;
