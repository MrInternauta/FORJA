import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  DistributionDimension,
  DistributionPoint,
  DistributionQuery,
  ExerciseHistory,
  ExerciseHistoryPoint,
  PersonalRecord,
  WeeklySummary,
  WeeklyVolumePoint,
} from "@forja/shared";
import { DatabaseService } from "../database/database.service";

/** Columna de `exercises` por dimension. Lista blanca: nunca se interpola input del usuario. */
const DIMENSION_COLUMN: Record<DistributionDimension, string> = {
  muscle_group: "e.muscle_group",
  equipment: "e.equipment",
};

/** 1RM estimado (Epley) en SQL; mismo contrato que `PersonalRecordSchema`. */
const epley = (w: string, r: string) =>
  `(case when ${r} = 0 then null
         when ${r} = 1 then ${w}::float8
         else round((${w} * (1 + ${r} / 30.0))::numeric, 1)::float8 end)`;

/**
 * Agregaciones de progreso. Todas cuentan solo sets completados de sesiones
 * TERMINADAS (`ended_at` no nulo): una sesion en curso no mueve las graficas.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly db: DatabaseService) {}

  /** Volumen (kg x reps de sets completados) por semana ISO. Contrato: GET /analytics/volume. */
  async weeklyVolume(userId: string, weeks: number): Promise<WeeklyVolumePoint[]> {
    return this.db.query<WeeklyVolumePoint>(
      `select to_char(date_trunc('week', w.started_at), 'YYYY-MM-DD') as week_start,
              coalesce(sum(ws.weight_kg * ws.reps) filter (where ws.is_completed), 0)::float8 as volume_kg,
              count(distinct w.id)::int as workouts
       from public.workouts w
       left join public.workout_exercises we on we.workout_id = w.id
       left join public.workout_sets ws on ws.workout_exercise_id = we.id
       where w.user_id = $1
         and w.ended_at is not null
         and w.started_at >= date_trunc('week', now()) - make_interval(weeks => $2 - 1)
       group by 1
       order by 1`,
      [userId, weeks],
    );
  }

  /**
   * Volumen y series por grupo muscular primario o por equipo. Contrato:
   * GET /analytics/distribution. Sin `from`/`to` abarca todo el historial.
   */
  async distribution(userId: string, q: DistributionQuery): Promise<DistributionPoint[]> {
    return this.db.query<DistributionPoint>(
      `select ${DIMENSION_COLUMN[q.by]}::text as key,
              coalesce(sum(ws.weight_kg * ws.reps), 0)::float8 as volume_kg,
              count(*)::int as sets
       from public.workout_sets ws
       join public.workout_exercises we on we.id = ws.workout_exercise_id
       join public.workouts w on w.id = we.workout_id
       join public.exercises e on e.id = we.exercise_id
       where w.user_id = $1
         and w.ended_at is not null
         and ws.is_completed
         and ($2::timestamptz is null or w.started_at >= $2)
         and ($3::timestamptz is null or w.started_at <= $3)
       group by 1
       order by volume_kg desc, sets desc, key`,
      [userId, q.from ?? null, q.to ?? null],
    );
  }

  /** PRs materializados por el sync (`exercise_prs`), el mas reciente primero. Contrato: GET /analytics/prs. */
  async personalRecords(userId: string): Promise<PersonalRecord[]> {
    return this.db.query<PersonalRecord>(
      `select p.exercise_id, e.name as exercise_name, e.muscle_group::text as muscle_group,
              p.weight_kg::float8 as weight_kg, p.reps::int as reps,
              ${epley("p.weight_kg", "p.reps")} as estimated_1rm_kg,
              p.achieved_at, p.workout_id
       from public.exercise_prs p
       join public.exercises e on e.id = p.exercise_id
       where p.user_id = $1
       order by p.achieved_at desc, e.name`,
      [userId],
    );
  }

  /**
   * Una fila por sesion terminada con el ejercicio: serie top (mas peso, desempate
   * por reps), mejor 1RM estimado, volumen y series. Contrato: GET /analytics/exercise/:id/history.
   */
  async exerciseHistory(userId: string, exerciseId: string, limit: number): Promise<ExerciseHistory> {
    const [exercise] = await this.db.query<ExerciseHistory["exercise"]>(
      "select id, name, muscle_group::text as muscle_group from public.exercises where id = $1",
      [exerciseId],
    );
    if (!exercise) throw new NotFoundException("Ejercicio no encontrado");

    const points = await this.db.query<ExerciseHistoryPoint>(
      `with sets as (
         select w.id as workout_id, w.started_at, ws.weight_kg, ws.reps
         from public.workout_sets ws
         join public.workout_exercises we on we.id = ws.workout_exercise_id
         join public.workouts w on w.id = we.workout_id
         where w.user_id = $1 and we.exercise_id = $2
           and w.ended_at is not null and ws.is_completed
       ),
       per_session as (
         select workout_id, started_at,
                max(${epley("weight_kg", "reps")}) as estimated_1rm_kg,
                sum(weight_kg * reps)::float8 as volume_kg,
                count(*)::int as sets
         from sets
         group by workout_id, started_at
       ),
       top_set as (
         select distinct on (workout_id) workout_id, weight_kg, reps
         from sets
         order by workout_id, weight_kg desc, reps desc
       )
       select p.workout_id, p.started_at,
              t.weight_kg::float8 as top_weight_kg, t.reps::int as top_reps,
              p.estimated_1rm_kg, p.volume_kg, p.sets
       from per_session p
       join top_set t using (workout_id)
       order by p.started_at desc
       limit $3`,
      [userId, exerciseId, limit],
    );

    return { exercise, points: points.reverse() };
  }

  /**
   * Resumen de UNA semana ISO (UTC, igual que volumen y racha): sesiones contra
   * el objetivo, volumen contra la semana anterior, PRs y medallas de la semana.
   * Por defecto la ultima semana completa ("cada lunes", diseno §8.1).
   * Contrato: GET /analytics/weekly-summary.
   */
  async weeklySummary(userId: string, week?: string): Promise<WeeklySummary> {
    const [bounds] = await this.db.query<{ week_start: string; latest: string }>(
      `select to_char(coalesce($1::date, date_trunc('week', now())::date - 7), 'YYYY-MM-DD') as week_start,
              to_char(date_trunc('week', now())::date - 7, 'YYYY-MM-DD') as latest`,
      [week ?? null],
    );
    if (bounds.week_start > bounds.latest) {
      throw new BadRequestException("Esa semana aún no termina: el resumen llega el lunes siguiente");
    }

    const [stats] = await this.db.query<{ weekly_goal: number; current_streak: number }>(
      "select weekly_goal, current_streak from public.user_stats where user_id = $1",
      [userId],
    );
    if (!stats) throw new NotFoundException("Perfil no encontrado: completa el onboarding");

    // Semana pedida y la anterior en una pasada: [ws - 7d, ws + 7d)
    const [agg] = await this.db.query<{
      sessions: number;
      volume_kg: number;
      sets: number;
      previous_volume_kg: number;
    }>(
      `with ws as (select $2::timestamptz as t)
       select count(distinct w.id) filter (where w.started_at >= ws.t)::int as sessions,
              coalesce(sum(s.weight_kg * s.reps) filter (where w.started_at >= ws.t and s.is_completed), 0)::float8 as volume_kg,
              count(s.id) filter (where w.started_at >= ws.t and s.is_completed)::int as sets,
              coalesce(sum(s.weight_kg * s.reps) filter (where w.started_at < ws.t and s.is_completed), 0)::float8 as previous_volume_kg
       from ws
       join public.workouts w on w.user_id = $1
         and w.ended_at is not null
         and w.started_at >= ws.t - interval '7 days'
         and w.started_at < ws.t + interval '7 days'
       left join public.workout_exercises we on we.workout_id = w.id
       left join public.workout_sets s on s.workout_exercise_id = we.id
       group by ws.t`,
      [userId, `${bounds.week_start}T00:00:00Z`],
    );

    const prs = await this.db.query<WeeklySummary["prs"][number]>(
      `select p.exercise_id, e.name as exercise_name, p.weight_kg::float8 as weight_kg, p.reps::int as reps
       from public.exercise_prs p
       join public.exercises e on e.id = p.exercise_id
       join public.workouts w on w.id = p.workout_id
       where p.user_id = $1
         and w.started_at >= $2::timestamptz and w.started_at < $2::timestamptz + interval '7 days'
       order by e.name`,
      [userId, `${bounds.week_start}T00:00:00Z`],
    );

    // earned_at = momento del sync que la otorgo (cercano al entrenamiento).
    const achievements = await this.db.query<WeeklySummary["achievements"][number]>(
      `select a.id, a.name, a.tier
       from public.user_achievements ua
       join public.achievements a on a.id = ua.achievement_id
       where ua.user_id = $1
         and ua.earned_at >= $2::timestamptz and ua.earned_at < $2::timestamptz + interval '7 days'
       order by a.sort_order`,
      [userId, `${bounds.week_start}T00:00:00Z`],
    );

    const sessions = agg?.sessions ?? 0;
    return {
      week_start: bounds.week_start,
      sessions,
      weekly_goal: stats.weekly_goal,
      goal_met: sessions >= stats.weekly_goal,
      volume_kg: agg?.volume_kg ?? 0,
      sets: agg?.sets ?? 0,
      previous_volume_kg: agg?.previous_volume_kg ?? 0,
      prs,
      achievements,
      current_streak: stats.current_streak,
      is_latest: bounds.week_start === bounds.latest,
    };
  }
}
