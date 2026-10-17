-- Gasol-IA · Demo sin cuentas: límite global diario de cálculos de ruta.
-- Protege al servidor público de OSRM. Sin datos personales: solo día y recuento.
create table public.gasol_uso_demo (
  dia   date primary key default current_date,
  rutas integer not null default 0
);
comment on table public.gasol_uso_demo is 'Cálculos de ruta por día en la demo pública (sin usuario ni IP).';
alter table public.gasol_uso_demo enable row level security;
revoke all on public.gasol_uso_demo from anon, authenticated;

create or replace function public.gasol_uso_demo_ruta(p_limite integer)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  insert into public.gasol_uso_demo as u (dia, rutas)
  values (current_date, 1)
  on conflict (dia) do update set rutas = u.rutas + 1
  returning rutas <= p_limite;
$$;
revoke execute on function public.gasol_uso_demo_ruta(integer) from public, anon, authenticated;
grant execute on function public.gasol_uso_demo_ruta(integer) to service_role;
