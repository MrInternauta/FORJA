import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  DistributionDimension,
  DistributionPoint,
  DistributionQuery,
  ExerciseHistory,
  ExerciseHistoryPoint,
  PersonalRecord,
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
}
