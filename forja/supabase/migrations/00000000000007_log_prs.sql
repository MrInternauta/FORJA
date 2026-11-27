-- ============================================================
-- FORJA - Log de eventos de PR (gamificacion §8)
-- ============================================================
-- `exercise_prs` solo guarda el PR VIGENTE por ejercicio: un PR superado
-- despues desaparece. Sin historial no se podia medir `prs_25` ("Rompe 25
-- records personales") ni mostrar en el resumen semanal los PRs de esa semana
-- que luego se superaron.
--
-- Una fila por (sesion, ejercicio) cuya mejor serie supero a todas las de
-- sesiones TERMINADAS anteriores (orden por ended_at, como `exercise_prs`).
-- La primera vez que se registra un ejercicio tambien cuenta: es lo que se
-- celebra como PR. El backend lo RECALCULA por ejercicio afectado en cada sync,
-- igual que `exercise_prs`: si se corrige o borra una sesion, el log sigue
-- siendo la verdad (sin eventos fantasma de un peso mal tecleado).

create table public.pr_events (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  workout_id  uuid not null references public.workouts(id) on delete cascade,
  weight_kg   numeric(6,2) not null,
  reps        smallint not null,
  -- ended_at de la sesion que lo logro
  achieved_at timestamptz not null,
  primary key (workout_id, exercise_id)
);

create index pr_events_user_idx on public.pr_events (user_id, exercise_id);

-- ===== RLS =====
-- Como exercise_prs: el dueno siempre; terceros solo si el perfil es publico.
-- Escritura solo backend (service role).
alter table public.pr_events enable row level security;

create policy pr_events_read on public.pr_events for select
  using (user_id = auth.uid()
         or exists (select 1 from public.profiles p
                    where p.id = user_id and p.is_public));

-- ===== Backfill con el historial existente =====
-- Misma derivacion que WorkoutsService.rebuildPrEvents. score ordena como
-- (peso desc, reps desc): reps <= 200 y 0.01 kg * 100000 = 1000 > 200.
insert into public.pr_events (user_id, exercise_id, workout_id, weight_kg, reps, achieved_at)
select user_id, exercise_id, workout_id, weight_kg, reps, ended_at
from (
  select b.*,
         max(b.score) over (
           partition by b.user_id, b.exercise_id
           order by b.ended_at, b.workout_id
           rows between unbounded preceding and 1 preceding
         ) as prev_best
  from (
    select distinct on (w.id, we.exercise_id)
           w.user_id, we.exercise_id, w.id as workout_id, w.ended_at, ws.weight_kg, ws.reps,
           ws.weight_kg * 100000 + ws.reps as score
    from public.workout_sets ws
    join public.workout_exercises we on we.id = ws.workout_exercise_id
    join public.workouts w on w.id = we.workout_id
    where w.ended_at is not null and ws.is_completed
    order by w.id, we.exercise_id, ws.weight_kg desc, ws.reps desc
  ) b
) r
where prev_best is null or score > prev_best;
