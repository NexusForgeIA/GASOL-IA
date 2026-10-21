-- Dos páginas más en la lista cerrada del contador: 'instalar-clic' (pulsan el botón Instalar) e
-- 'instalacion' (el navegador confirma que se instaló). Siguen siendo recuentos, no personas.
alter table public.gasol_visitas drop constraint gasol_visitas_pagina_check;
alter table public.gasol_visitas add constraint gasol_visitas_pagina_check check (pagina in ('portada','inicio','comparador','ruta','calculadoras','favoritas',
  'gastos','ingresos','vencimientos','cuenta','privacidad','aviso-legal','instalar','instalar-clic','instalacion'));
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
      'gastos','ingresos','vencimientos','cuenta','privacidad','aviso-legal','instalar','instalar-clic','instalacion')
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
