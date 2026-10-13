-- ============================================================
-- FORJA - Recompensas pendientes de celebrar (plan de diseno §8.3)
-- ============================================================
-- Antes las recompensas solo viajaban en la respuesta del POST de sync que
-- APLICABA la sesion: si esa respuesta se perdia (navegacion al reconectar,
-- red que cae a mitad, app cerrada) el reintento daba `skipped_stale` sin
-- recompensas y la celebracion se perdia aunque el PR quedara guardado.
--
-- Ahora el backend escribe cada recompensa aqui, en la misma transaccion que
-- la calcula, y el cliente las lee y confirma (seen_at) al celebrarlas.
-- Entrega "al menos una vez": si la confirmacion se pierde, se vuelve a mostrar.

create table public.pending_rewards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  -- Espejo de REWARD_KINDS en packages/shared/src/enums.ts
  kind       text not null check (kind in ('pr', 'achievement', 'streak')),
  -- pr: {exercise_id, exercise_name, weight_kg, reps} · achievement: {id} · streak: {delta}
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  seen_at    timestamptz
);

-- Lo unico que se consulta: las no vistas de un usuario, en orden.
create index pending_rewards_unseen_idx
  on public.pending_rewards (user_id, created_at)
  where seen_at is null;

-- ===== RLS =====
-- Solo el dueno las lee; escritura y confirmacion solo backend (service role).
alter table public.pending_rewards enable row level security;

create policy pending_rewards_read on public.pending_rewards for select
  using (user_id = auth.uid());
