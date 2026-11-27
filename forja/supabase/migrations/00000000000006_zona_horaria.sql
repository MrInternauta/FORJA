-- Zona horaria por usuario (IANA, p. ej. 'America/Mexico_City').
--
-- Volumen semanal, resumen semanal y racha cortaban las semanas con
-- date_trunc('week') en la zona de la BD (UTC): una sesion del domingo en la
-- noche en Mexico caia en la semana siguiente. Ahora se cortan en el lunes 00:00
-- de la zona del usuario. Default = mercado es-MX (espejo de DEFAULT_TIME_ZONE en
-- @forja/shared); el cliente la corrige con la zona del dispositivo (PATCH /me).
alter table public.profiles
  add column time_zone text not null default 'America/Mexico_City';

-- profiles tambien se actualiza directo por RLS (profiles_update), no solo por la
-- API, y una zona que Postgres no reconoce romperia cada consulta con
-- `at time zone` de ese usuario. Postgres la rechaza con 22023 (invalid_parameter_value).
create or replace function public.validar_zona_horaria() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform now() at time zone new.time_zone;
  return new;
end;
$$;

create trigger profiles_zona_horaria_valida
  before insert or update of time_zone on public.profiles
  for each row execute function public.validar_zona_horaria();
