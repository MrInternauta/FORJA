import { Injectable, Logger } from "@nestjs/common";
import type { PoolClient } from "pg";
import type {
  ExerciseLastSet,
  SyncItemResult,
  SyncOperation,
  SyncResponse,
  SyncRewards,
  Workout,
} from "@forja/shared";
import { DatabaseService } from "../database/database.service";

/**
 * Sincronizacion offline (arquitectura §6 + plan de diseno §8.3).
 *
 * Reglas:
 * - IDs generados por el cliente => cada operacion es idempotente (upsert por PK).
 * - LWW a nivel de documento-workout usando client_updated_at: el servidor aplica
 *   solo si la version entrante es mas nueva; si no, responde `skipped_stale`.
 * - Las recompensas (PRs, stats, racha, medallas) se calculan AQUI, nunca en el
 *   cliente: una sola fuente de verdad, resistente a relojes de dispositivo.
 * - Si el usuario entreno offline, la celebracion viaja en la respuesta del sync:
 *   la recompensa nunca se pierde.
 */
@Injectable()
export class WorkoutsService {
  private readonly logger = new Logger(WorkoutsService.name);

  constructor(private readonly db: DatabaseService) {}

  /* ============================ Lectura ============================ */

  async list(userId: string, opts: { from?: string; to?: string; cursor?: string }) {
    const params: unknown[] = [userId];
    const where: string[] = ["w.user_id = $1"];
    if (opts.from) {
      params.push(opts.from);
      where.push(`w.started_at >= $${params.length}`);
    }
    if (opts.to) {
      params.push(opts.to);
      where.push(`w.started_at <= $${params.length}`);
    }
    if (opts.cursor) {
      params.push(opts.cursor);
      where.push(
        `(w.started_at, w.id) < (select started_at, id from public.workouts where id = $${params.length})`,
      );
    }
    const items = await this.db.query(
      `select w.id, w.title, w.notes, w.started_at, w.ended_at, w.duration_seconds,
              w.routine_id, w.client_updated_at,
              coalesce(sum(ws.weight_kg * ws.reps) filter (where ws.is_completed), 0)::float8 as volume_kg,
              count(ws.id) filter (where ws.is_completed)::int as sets_completed
       from public.workouts w
       left join public.workout_exercises we on we.workout_id = w.id
       left join public.workout_sets ws on ws.workout_exercise_id = we.id
       where ${where.join(" and ")}
       group by w.id
       order by w.started_at desc, w.id desc
       limit 20`,
      params,
    );
    return {
      items,
      next_cursor: items.length === 20 ? (items[items.length - 1] as { id: string }).id : null,
    };
  }

  /**
   * Ultimo set completado del usuario para un ejercicio (autocompletar el logger, plan §6.2).
   * null si nunca se registro: la UI cae al peso objetivo de la rutina o vacio.
   */
  async lastSet(userId: string, exerciseId: string): Promise<ExerciseLastSet | null> {
    const [row] = await this.db.query<ExerciseLastSet>(
      `select ws.weight_kg::float8 as weight_kg, ws.reps::int as reps, ws.rpe::float8 as rpe
       from public.workout_sets ws
       join public.workout_exercises we on we.id = ws.workout_exercise_id
       join public.workouts w on w.id = we.workout_id
       where w.user_id = $1 and we.exercise_id = $2 and ws.is_completed
       order by w.started_at desc, ws.position desc
       limit 1`,
      [userId, exerciseId],
    );
    return row ?? null;
  }

  /* ============================ Sync ============================ */

  async sync(userId: string, operations: SyncOperation[]): Promise<SyncResponse> {
    const results: SyncItemResult[] = [];
    const touchedExercises = new Set<string>();

    // Cada operacion en su propia transaccion: un item corrupto no tumba el lote.
    for (const op of operations) {
      try {
        if (op.op === "delete") {
          await this.db.query(
            "delete from public.workouts where id = $1 and user_id = $2",
            [op.workout_id, userId],
          );
          results.push({ id: op.workout_id, status: "applied" }); // idempotente
        } else {
          const status = await this.db.tx((tx) => this.upsertWorkout(tx, userId, op.workout));
          if (status === "applied") {
            for (const ex of op.workout.exercises) touchedExercises.add(ex.exercise_id);
          }
          results.push({ id: op.workout.id, status });
        }
      } catch (err) {
        this.logger.warn(`Sync item fallo: ${(err as Error).message}`);
        const id = op.op === "delete" ? op.workout_id : op.workout.id;
        results.push({ id, status: "error", message: "No se pudo aplicar la operacion" });
      }
    }

    const rewards = await this.computeRewards(userId, [...touchedExercises]).catch((err) => {
      // Las recompensas nunca deben romper el sync de datos del usuario.
      this.logger.error(`Calculo de recompensas fallo: ${(err as Error).message}`);
      return { new_prs: [], new_achievements: [], streak_delta: 0 } satisfies SyncRewards;
    });

    return { results, rewards };
  }

  /**
   * Upsert LWW. Estrategia "replace": si la version entrante gana, los hijos
   * (ejercicios/sets) se reemplazan completos: sin merges parciales que razonar.
   */
  private async upsertWorkout(
    tx: PoolClient,
    userId: string,
    w: Workout,
  ): Promise<"applied" | "skipped_stale"> {
    const existing = await tx.query<{ user_id: string; client_updated_at: string }>(
      "select user_id, client_updated_at from public.workouts where id = $1 for update",
      [w.id],
    );

    if (existing.rowCount) {
      const row = existing.rows[0];
      if (row.user_id !== userId) {
        // Colision de uuid v4 entre usuarios: probabilidad despreciable; se trata como error.
        throw new Error("El id de workout pertenece a otro usuario");
      }
      if (new Date(row.client_updated_at) >= new Date(w.client_updated_at)) {
        return "skipped_stale";
      }
      await tx.query(
        `update public.workouts
         set routine_id = $2, title = $3, notes = $4, started_at = $5, ended_at = $6,
             client_updated_at = $7
         where id = $1`,
        [w.id, w.routine_id ?? null, w.title, w.notes ?? null, w.started_at, w.ended_at ?? null, w.client_updated_at],
      );
      // Reemplazo completo de hijos (cascada borra los sets):
      await tx.query("delete from public.workout_exercises where workout_id = $1", [w.id]);
    } else {
      await tx.query(
        `insert into public.workouts (id, user_id, routine_id, title, notes, started_at, ended_at, client_updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [w.id, userId, w.routine_id ?? null, w.title, w.notes ?? null, w.started_at, w.ended_at ?? null, w.client_updated_at],
      );
    }

    for (const ex of w.exercises) {
      await tx.query(
        `insert into public.workout_exercises (id, workout_id, exercise_id, position)
         values ($1, $2, $3, $4)`,
        [ex.id, w.id, ex.exercise_id, ex.position],
      );
      for (const s of ex.sets) {
        await tx.query(
          `insert into public.workout_sets (id, workout_exercise_id, position, reps, weight_kg, rpe, is_completed)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [s.id, ex.id, s.position, s.reps, s.weight_kg, s.rpe ?? null, s.is_completed],
        );
      }
    }
    return "applied";
  }

  /* ============================ Recompensas ============================ */

  private async computeRewards(userId: string, exerciseIds: string[]): Promise<SyncRewards> {
    return this.db.tx(async (tx) => {
      const newPrs = await this.detectPrs(tx, userId, exerciseIds);
      const { streakDelta, stats } = await this.recomputeStats(tx, userId);
      const newAchievements = await this.awardAchievements(tx, userId, stats);
      return { new_prs: newPrs, new_achievements: newAchievements, streak_delta: streakDelta };
    });
  }

  /**
   * PR = mejor peso por ejercicio (desempate por reps), sobre sets completados
   * de sesiones TERMINADAS. Los syncs a mitad de sesion no otorgan PRs: asi el
   * PR llega en el sync que cierra la sesion y lo celebra su resumen.
   * Se materializa en exercise_prs; solo devolvemos los que MEJORAN.
   */
  private async detectPrs(tx: PoolClient, userId: string, exerciseIds: string[]) {
    if (exerciseIds.length === 0) return [];
    const { rows } = await tx.query<{
      exercise_id: string;
      exercise_name: string;
      weight_kg: number;
      reps: number;
    }>(
      `with best as (
         select we.exercise_id,
                ws.weight_kg,
                ws.reps,
                w.id as workout_id,
                row_number() over (
                  partition by we.exercise_id
                  order by ws.weight_kg desc, ws.reps desc
                ) as rn
         from public.workout_sets ws
         join public.workout_exercises we on we.id = ws.workout_exercise_id
         join public.workouts w on w.id = we.workout_id
         where w.user_id = $1 and w.ended_at is not null and ws.is_completed
           and we.exercise_id = any($2::uuid[])
       ),
       upserted as (
         insert into public.exercise_prs (user_id, exercise_id, weight_kg, reps, workout_id)
         select $1, exercise_id, weight_kg, reps, workout_id from best where rn = 1
         on conflict (user_id, exercise_id) do update
           set weight_kg = excluded.weight_kg,
               reps = excluded.reps,
               workout_id = excluded.workout_id,
               achieved_at = now()
           where excluded.weight_kg > public.exercise_prs.weight_kg
              or (excluded.weight_kg = public.exercise_prs.weight_kg
                  and excluded.reps > public.exercise_prs.reps)
         returning exercise_id, weight_kg, reps,
                   (xmax = 0) as inserted
       )
       select u.exercise_id, e.name as exercise_name,
              u.weight_kg::float8 as weight_kg, u.reps::int as reps
       from upserted u
       join public.exercises e on e.id = u.exercise_id`,
      [userId, exerciseIds],
    );
    return rows;
  }

  /**
   * Recalculo integro de stats (volumen total, sesiones, racha semanal).
   * O(datos del usuario): correcto por construccion frente a upserts repetidos,
   * y sobrado a la escala del anio 1. Optimizar solo si el perfilado lo pide.
   */
  private async recomputeStats(tx: PoolClient, userId: string) {
    const {
      rows: [totals],
    } = await tx.query<{ total_volume_kg: number; total_workouts: number }>(
      `select coalesce(sum(ws.weight_kg * ws.reps) filter (where ws.is_completed), 0)::float8 as total_volume_kg,
              count(distinct w.id) filter (where w.ended_at is not null)::int as total_workouts
       from public.workouts w
       left join public.workout_exercises we on we.workout_id = w.id
       left join public.workout_sets ws on ws.workout_exercise_id = we.id
       where w.user_id = $1`,
      [userId],
    );

    const {
      rows: [goalRow],
    } = await tx.query<{ weekly_goal: number; current_streak: number }>(
      "select weekly_goal, current_streak from public.user_stats where user_id = $1 for update",
      [userId],
    );
    const weeklyGoal = goalRow?.weekly_goal ?? 3;
    const prevStreak = goalRow?.current_streak ?? 0;

    // Sesiones terminadas por semana ISO, ultimas 104 semanas.
    const { rows: weeks } = await tx.query<{ week_start: string; sessions: number }>(
      `select to_char(date_trunc('week', started_at), 'YYYY-MM-DD') as week_start,
              count(*)::int as sessions
       from public.workouts
       where user_id = $1 and ended_at is not null
         and started_at >= date_trunc('week', now()) - interval '104 weeks'
       group by 1`,
      [userId],
    );
    const byWeek = new Map(weeks.map((r) => [r.week_start, r.sessions]));

    // Racha: semanas consecutivas cumplidas terminando en la semana pasada;
    // la semana en curso suma solo si YA se cumplio (no rompe la racha mientras avanza).
    // TODO(gamificacion v2): consumir grace_weeks para puentear una semana fallida.
    const currentWeek = startOfIsoWeek(new Date());
    let streak = 0;
    if ((byWeek.get(fmt(currentWeek)) ?? 0) >= weeklyGoal) streak++;
    for (let i = 1; i <= 104; i++) {
      const wk = fmt(addWeeks(currentWeek, -i));
      if ((byWeek.get(wk) ?? 0) >= weeklyGoal) streak++;
      else break;
    }

    const {
      rows: [stats],
    } = await tx.query<{
      total_volume_kg: number;
      total_workouts: number;
      current_streak: number;
      longest_streak: number;
    }>(
      `update public.user_stats
       set total_volume_kg = $2,
           total_workouts  = $3,
           current_streak  = $4,
           longest_streak  = greatest(longest_streak, $4),
           updated_at      = now()
       where user_id = $1
       returning total_volume_kg::float8 as total_volume_kg, total_workouts,
                 current_streak, longest_streak`,
      [userId, totals.total_volume_kg, totals.total_workouts, streak],
    );

    return { streakDelta: streak - prevStreak, stats };
  }

  /** Otorga logros elegibles no ganados. Devuelve los slugs nuevos para la celebracion. */
  private async awardAchievements(
    tx: PoolClient,
    userId: string,
    stats: { total_volume_kg: number; total_workouts: number; current_streak: number; longest_streak: number },
  ): Promise<string[]> {
    const eligible: string[] = [];
    const w = stats.total_workouts;
    const v = stats.total_volume_kg;
    const s = stats.longest_streak;

    if (w >= 1) eligible.push("primera_sesion");
    if (w >= 10) eligible.push("sesiones_10");
    if (w >= 50) eligible.push("sesiones_50");
    if (w >= 100) eligible.push("sesiones_100");
    if (w >= 365) eligible.push("sesiones_365");
    if (v >= 10_000) eligible.push("volumen_10k");
    if (v >= 100_000) eligible.push("volumen_100k");
    if (v >= 500_000) eligible.push("volumen_500k");
    if (v >= 1_000_000) eligible.push("volumen_1m");
    if (s >= 4) eligible.push("racha_4");
    if (s >= 12) eligible.push("racha_12");
    if (s >= 26) eligible.push("racha_26");
    if (s >= 52) eligible.push("racha_52");

    const {
      rows: [{ prs }],
    } = await tx.query<{ prs: number }>(
      "select count(*)::int as prs from public.exercise_prs where user_id = $1",
      [userId],
    );
    if (prs >= 1) eligible.push("primer_pr");
    // TODO('prs_25'): requiere log de eventos de PR (no solo el PR vigente por ejercicio).

    if (eligible.length === 0) return [];
    const { rows } = await tx.query<{ achievement_id: string }>(
      `insert into public.user_achievements (user_id, achievement_id)
       select $1, unnest($2::text[])
       on conflict do nothing
       returning achievement_id`,
      [userId, eligible],
    );
    return rows.map((r) => r.achievement_id);
  }
}

/* ===== Helpers de semana ISO (lunes) ===== */
function startOfIsoWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // domingo=7
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date;
}
function addWeeks(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n * 7);
  return out;
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
