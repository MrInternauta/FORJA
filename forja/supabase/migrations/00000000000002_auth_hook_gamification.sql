-- ============================================================
-- FORJA - Hook de token (claim de rol) + gamificacion
-- Fuente: arquitectura §5 y plan de diseno §8.3
-- ============================================================

-- ===== Custom Access Token Hook =====
-- Inyecta `user_role` en el JWT leyendo profiles.role.
-- IMPORTANTE: tras aplicar la migracion, activar el hook en
-- Dashboard > Authentication > Hooks > Custom Access Token  ->  public.custom_access_token
-- (o en supabase/config.toml para el stack local: [auth.hook.custom_access_token]).
create or replace function public.custom_access_token(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_role public.app_role;
begin
  select role into user_role
  from public.profiles
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';
  claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(user_role::text, 'FREE')));
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant execute on function public.custom_access_token to supabase_auth_admin;
revoke execute on function public.custom_access_token from authenticated, anon, public;

-- ===== Gamificacion =====
create table public.user_stats (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  weekly_goal     smallint not null default 3 check (weekly_goal between 1 and 7),
  current_streak  int not null default 0,   -- semanas cumplidas consecutivas
  longest_streak  int not null default 0,
  grace_weeks     smallint not null default 0,
  total_volume_kg numeric(12,2) not null default 0,
  total_workouts  int not null default 0,
  updated_at      timestamptz not null default now()
);

create table public.achievements (
  id          text primary key,             -- slug estable, p.ej. 'volumen_100k'
  name        text not null,
  description text not null,
  tier        text not null check (tier in ('hierro','bronce','plata','oro','platino')),
  sort_order  smallint not null
);

create table public.user_achievements (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id),
  earned_at      timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ===== PRs materializados (mejor peso por ejercicio) =====
-- Lo mantiene el backend en el sync; evita recalcular sobre todo el historial.
create table public.exercise_prs (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  weight_kg   numeric(6,2) not null,
  reps        smallint not null,
  achieved_at timestamptz not null default now(),
  workout_id  uuid references public.workouts(id) on delete set null,
  primary key (user_id, exercise_id)
);

-- ===== RLS =====
alter table public.user_stats        enable row level security;
alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;
alter table public.exercise_prs      enable row level security;

-- Catalogo de logros: lectura para autenticados; escritura solo service role.
create policy achievements_read on public.achievements for select
  using (auth.role() = 'authenticated');

-- Stats/medallas/PRs: el dueno siempre; terceros solo si el perfil es publico
-- (vitrina en perfiles publicos, Fase 2). Escritura solo backend (service role).
create policy user_stats_read on public.user_stats for select
  using (user_id = auth.uid()
         or exists (select 1 from public.profiles p
                    where p.id = user_id and p.is_public));

create policy user_achievements_read on public.user_achievements for select
  using (user_id = auth.uid()
         or exists (select 1 from public.profiles p
                    where p.id = user_id and p.is_public));

create policy exercise_prs_read on public.exercise_prs for select
  using (user_id = auth.uid()
         or exists (select 1 from public.profiles p
                    where p.id = user_id and p.is_public));

-- ===== Seed: set inicial de logros (MVP ~15, tiers de metal) =====
insert into public.achievements (id, name, description, tier, sort_order) values
  ('primera_sesion',   'Primer golpe',      'Completa tu primer entrenamiento',            'hierro',  1),
  ('sesiones_10',      'Ritmo constante',   'Completa 10 entrenamientos',                  'hierro',  2),
  ('sesiones_50',      'Oficio',            'Completa 50 entrenamientos',                  'bronce',  3),
  ('sesiones_100',     'Centenario',        'Completa 100 entrenamientos',                 'plata',   4),
  ('sesiones_365',     'Un anio de forja',  'Completa 365 entrenamientos',                 'oro',     5),
  ('volumen_10k',      '10 toneladas',      'Acumula 10,000 kg de volumen total',          'hierro',  6),
  ('volumen_100k',     '100 toneladas',     'Acumula 100,000 kg de volumen total',         'bronce',  7),
  ('volumen_500k',     'Medio millon',      'Acumula 500,000 kg de volumen total',         'plata',   8),
  ('volumen_1m',       'Millon forjado',    'Acumula 1,000,000 kg de volumen total',       'oro',     9),
  ('racha_4',          'Un mes al fuego',   'Cumple tu objetivo semanal 4 semanas seguidas',  'hierro', 10),
  ('racha_12',         'Trimestre solido',  'Cumple tu objetivo semanal 12 semanas seguidas', 'bronce', 11),
  ('racha_26',         'Medio anio',        'Cumple tu objetivo semanal 26 semanas seguidas', 'plata',  12),
  ('racha_52',         'Anio inquebrantable','Cumple tu objetivo semanal 52 semanas seguidas','platino',13),
  ('primer_pr',        'Primera marca',     'Rompe tu primer record personal',             'hierro', 14),
  ('prs_25',           'Coleccionista',     'Rompe 25 records personales',                 'plata',  15);

-- ===== Seed: catalogo inicial de ejercicios (subset; el ADMIN lo amplia) =====
insert into public.exercises (name, description, muscle_group, secondary_muscles, equipment) values
  ('Press banca',            'Empuje horizontal con barra en banco plano.',            'chest',      '{shoulders,triceps}', 'barbell'),
  ('Press inclinado c/manc.','Empuje en banco inclinado con mancuernas.',              'chest',      '{shoulders,triceps}', 'dumbbell'),
  ('Sentadilla trasera',     'Sentadilla con barra sobre la espalda.',                 'quads',      '{glutes,core}',       'barbell'),
  ('Peso muerto',            'Levantamiento de barra desde el suelo.',                 'back',       '{hamstrings,glutes}', 'barbell'),
  ('Peso muerto rumano',     'Bisagra de cadera con piernas semirrigidas.',            'hamstrings', '{glutes,back}',       'barbell'),
  ('Dominadas',              'Traccion vertical con peso corporal.',                   'back',       '{biceps}',            'bodyweight'),
  ('Remo con barra',         'Traccion horizontal con barra.',                         'back',       '{biceps}',            'barbell'),
  ('Press militar',          'Empuje vertical de barra de pie.',                       'shoulders',  '{triceps,core}',      'barbell'),
  ('Curl con barra',         'Flexion de codo con barra.',                             'biceps',     '{forearms}',          'barbell'),
  ('Extension de triceps en polea', 'Extension de codo en polea alta.',                'triceps',    '{}',                  'cable'),
  ('Prensa de piernas',      'Empuje de plataforma en maquina.',                       'quads',      '{glutes}',            'machine'),
  ('Elevacion de talones',   'Extension de tobillo de pie o en maquina.',              'calves',     '{}',                  'machine'),
  ('Plancha',                'Isometrico de core en apoyo de antebrazos.',             'core',       '{}',                  'bodyweight'),
  ('Hip thrust',             'Extension de cadera con apoyo en banco.',                'glutes',     '{hamstrings}',        'barbell');
