-- ============================================================
-- FORJA - Migracion inicial
-- Fuente: documento de arquitectura §3 (modelo de datos + RLS)
-- ============================================================

-- ===== Enums =====
create type app_role as enum ('ADMIN', 'PRO', 'FREE');
create type muscle_group as enum (
  'chest','back','shoulders','biceps','triceps','forearms',
  'quads','hamstrings','glutes','calves','core','full_body','cardio'
);
create type equipment_type as enum (
  'barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','cardio_machine','other'
);
create type subscription_status as enum ('active','past_due','canceled','incomplete');

-- ===== Perfiles (1:1 con auth.users) =====
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text,
  avatar_url   text,
  role         app_role not null default 'FREE',
  is_public    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ===== Catalogo de ejercicios (curado por ADMIN) =====
create table public.exercises (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text,
  muscle_group      muscle_group not null,
  secondary_muscles muscle_group[] not null default '{}',
  equipment         equipment_type not null,
  media_url         text,
  media_type        text check (media_type in ('image','video')),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index idx_exercises_muscle    on public.exercises (muscle_group) where is_active;
create index idx_exercises_equipment on public.exercises (equipment)    where is_active;

-- ===== Rutinas (plantillas) =====
create table public.routines (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text,
  is_public   boolean not null default false,
  copied_from uuid references public.routines(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_routines_owner on public.routines (owner_id);

create table public.routine_exercises (
  id          uuid primary key default gen_random_uuid(),
  routine_id  uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  position    smallint not null,
  notes       text,
  unique (routine_id, position)
);
create index idx_re_routine on public.routine_exercises (routine_id);

create table public.routine_sets (
  id                  uuid primary key default gen_random_uuid(),
  routine_exercise_id uuid not null references public.routine_exercises(id) on delete cascade,
  position            smallint not null,
  target_reps         smallint check (target_reps between 1 and 100),
  target_weight_kg    numeric(6,2) check (target_weight_kg >= 0),
  target_rpe          numeric(3,1) check (target_rpe between 1 and 10),
  unique (routine_exercise_id, position)
);

-- ===== Entrenamientos (id generado por el CLIENTE => sync idempotente) =====
create table public.workouts (
  id                uuid primary key,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  routine_id        uuid references public.routines(id) on delete set null,
  title             text not null default 'Entrenamiento',
  notes             text,
  started_at        timestamptz not null,
  ended_at          timestamptz,
  duration_seconds  int generated always as
    (case when ended_at is null then null
          else extract(epoch from (ended_at - started_at))::int end) stored,
  client_updated_at timestamptz not null,
  created_at        timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index idx_workouts_user_date on public.workouts (user_id, started_at desc);

create table public.workout_exercises (
  id          uuid primary key,
  workout_id  uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  position    smallint not null,
  unique (workout_id, position)
);
create index idx_we_workout on public.workout_exercises (workout_id);

create table public.workout_sets (
  id                  uuid primary key,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  position            smallint not null,
  reps                smallint not null check (reps between 0 and 200),
  weight_kg           numeric(6,2) not null default 0 check (weight_kg >= 0),
  rpe                 numeric(3,1) check (rpe between 1 and 10),
  is_completed        boolean not null default true,
  unique (workout_exercise_id, position)
);
create index idx_ws_we on public.workout_sets (workout_exercise_id);

-- ===== Social (Fase 2; tablas creadas ya para estabilizar RLS de visibilidad) =====
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index idx_follows_followee on public.follows (followee_id);

create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  caption    text,
  created_at timestamptz not null default now(),
  unique (workout_id)
);
create index idx_posts_feed on public.posts (created_at desc);

-- ===== Billing (Fase 3) =====
create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  provider                 text not null default 'stripe',
  provider_customer_id     text not null,
  provider_subscription_id text not null unique,
  status                   subscription_status not null,
  current_period_end       timestamptz not null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index idx_subs_user on public.subscriptions (user_id);

-- ============================================================
-- RLS
-- ============================================================

-- Helper: rol desde el claim `user_role` del JWT (ver hook en 0002)
create or replace function public.jwt_role() returns app_role
language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'user_role')::app_role,
    'FREE'
  );
$$;

alter table public.profiles          enable row level security;
alter table public.exercises         enable row level security;
alter table public.routines          enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.routine_sets      enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets      enable row level security;
alter table public.follows           enable row level security;
alter table public.posts             enable row level security;
alter table public.subscriptions     enable row level security;

-- ----- Perfiles -----
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or is_public or public.jwt_role() = 'ADMIN');
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- El cambio de role se hace SOLO via service role (backend); ninguna politica lo permite.

-- ----- Catalogo -----
create policy exercises_select on public.exercises for select
  using (auth.role() = 'authenticated');
create policy exercises_admin_write on public.exercises for all
  using (public.jwt_role() = 'ADMIN') with check (public.jwt_role() = 'ADMIN');

-- ----- Rutinas -----
create policy routines_owner_all on public.routines for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy routines_public_read on public.routines for select
  using (is_public);

-- routine_exercises: hereda del padre
create policy re_select on public.routine_exercises for select
  using (exists (select 1 from public.routines r
                 where r.id = routine_id
                   and (r.owner_id = auth.uid() or r.is_public)));
create policy re_write on public.routine_exercises for all
  using (exists (select 1 from public.routines r
                 where r.id = routine_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.routines r
                      where r.id = routine_id and r.owner_id = auth.uid()));

-- routine_sets: hereda via routine_exercises -> routines
create policy rs_select on public.routine_sets for select
  using (exists (select 1
                 from public.routine_exercises re
                 join public.routines r on r.id = re.routine_id
                 where re.id = routine_exercise_id
                   and (r.owner_id = auth.uid() or r.is_public)));
create policy rs_write on public.routine_sets for all
  using (exists (select 1
                 from public.routine_exercises re
                 join public.routines r on r.id = re.routine_id
                 where re.id = routine_exercise_id and r.owner_id = auth.uid()))
  with check (exists (select 1
                      from public.routine_exercises re
                      join public.routines r on r.id = re.routine_id
                      where re.id = routine_exercise_id and r.owner_id = auth.uid()));

-- ----- Workouts -----
create policy workouts_owner_all on public.workouts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy workouts_posted_read on public.workouts for select
  using (exists (select 1 from public.posts p
                 join public.profiles pr on pr.id = public.workouts.user_id
                 where p.workout_id = public.workouts.id and pr.is_public));

-- workout_exercises: hereda del workout padre
create policy we_select on public.workout_exercises for select
  using (exists (select 1 from public.workouts w
                 where w.id = workout_id
                   and (w.user_id = auth.uid()
                        or exists (select 1 from public.posts p
                                   join public.profiles pr on pr.id = w.user_id
                                   where p.workout_id = w.id and pr.is_public))));
create policy we_write on public.workout_exercises for all
  using (exists (select 1 from public.workouts w
                 where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workouts w
                      where w.id = workout_id and w.user_id = auth.uid()));

-- workout_sets: hereda via workout_exercises -> workouts
create policy ws_select on public.workout_sets for select
  using (exists (select 1
                 from public.workout_exercises we
                 join public.workouts w on w.id = we.workout_id
                 where we.id = workout_exercise_id
                   and (w.user_id = auth.uid()
                        or exists (select 1 from public.posts p
                                   join public.profiles pr on pr.id = w.user_id
                                   where p.workout_id = w.id and pr.is_public))));
create policy ws_write on public.workout_sets for all
  using (exists (select 1
                 from public.workout_exercises we
                 join public.workouts w on w.id = we.workout_id
                 where we.id = workout_exercise_id and w.user_id = auth.uid()))
  with check (exists (select 1
                      from public.workout_exercises we
                      join public.workouts w on w.id = we.workout_id
                      where we.id = workout_exercise_id and w.user_id = auth.uid()));

-- ----- Social -----
create policy follows_read on public.follows for select
  using (auth.role() = 'authenticated');
create policy follows_manage on public.follows for all
  using (follower_id = auth.uid()) with check (follower_id = auth.uid());

create policy posts_read on public.posts for select
  using (auth.role() = 'authenticated');
create policy posts_manage on public.posts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----- Billing -----
create policy subs_read_own on public.subscriptions for select
  using (user_id = auth.uid());
-- Escritura de subscriptions: solo service role (webhooks en NestJS).
