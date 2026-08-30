-- ============================================================
-- Stubs del entorno Supabase para la base de datos de compose.
-- Permiten aplicar las migraciones reales sobre Postgres "plano"
-- (modo desarrollo de la API sin el stack completo de Supabase).
-- En produccion y con `supabase start` este archivo NO se usa:
-- alli el esquema auth existe de verdad.
-- ============================================================
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);

-- En Supabase real, auth.uid()/auth.role() leen el JWT del request.
-- Aqui devuelven valores neutros: la API se conecta con rol privilegiado
-- y aplica la autorizacion en guards/servicios (arquitectura §5).
create or replace function auth.uid() returns uuid
language sql stable as $$ select null::uuid $$;
create or replace function auth.role() returns text
language sql stable as $$ select 'authenticated'::text $$;

do $$ begin
  create role supabase_auth_admin nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;
