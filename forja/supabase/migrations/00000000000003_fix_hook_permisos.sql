-- ============================================================
-- FORJA - Arreglo del Custom Access Token Hook
-- El hook corre como `supabase_auth_admin` (search_path = auth), no como
-- postgres. Eso rompia el signup con 500 por dos motivos encadenados.
-- ============================================================

-- 1) `jwt_role()` es `language sql`, asi que Postgres la INLINEA dentro de la
--    politica RLS `profiles_select`. Con el search_path de supabase_auth_admin,
--    el `::app_role` sin cualificar no resuelve y el plan falla con
--    `type "app_role" does not exist` (SQLSTATE 42704). Cualificamos el esquema
--    en el tipo de retorno y en el cast; se mantiene inlineable (RLS rapida).
create or replace function public.jwt_role() returns public.app_role
language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'user_role')::public.app_role,
    'FREE'::public.app_role
  );
$$;

-- 2) El hook lee `public.profiles`, pero supabase_auth_admin no tenia SELECT
--    sobre la tabla ni politica que lo dejara pasar (RLS esta activa y el rol
--    no es owner). Receta documentada por Supabase para este hook.
grant usage on schema public to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;

drop policy if exists profiles_auth_admin_select on public.profiles;
create policy profiles_auth_admin_select on public.profiles
  for select to supabase_auth_admin
  using (true);
