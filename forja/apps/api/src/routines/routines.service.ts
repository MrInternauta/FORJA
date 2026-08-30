import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import type { AppRole, CreateRoutineInput, RoutineDetail, RoutineSummary } from "@forja/shared";
import { PLAN_LIMITS } from "@forja/shared";
import { DatabaseService } from "../database/database.service";

/**
 * Rutinas (contratos §4). Tercera capa de autorizacion (arquitectura §5):
 * ownership explicito en cada query + limites de plan aplicados AQUI
 * (una sola fuente de verdad; RLS queda como red de seguridad).
 */
@Injectable()
export class RoutinesService {
  constructor(private readonly db: DatabaseService) {}

  async list(userId: string, cursor?: string): Promise<{ items: RoutineSummary[]; next_cursor: string | null }> {
    const params: unknown[] = [userId];
    let cursorWhere = "";
    if (cursor) {
      params.push(cursor);
      cursorWhere = `and (r.updated_at, r.id) < (select updated_at, id from public.routines where id = $${params.length})`;
    }
    const items = await this.db.query<RoutineSummary>(
      `select r.id, r.name, r.description,
              count(re.id)::int as exercise_count,
              to_char(r.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
       from public.routines r
       left join public.routine_exercises re on re.routine_id = r.id
       where r.owner_id = $1 ${cursorWhere}
       group by r.id
       order by r.updated_at desc, r.id desc
       limit 50`,
      params,
    );
    return { items, next_cursor: items.length === 50 ? items[items.length - 1].id : null };
  }

  /** Visible si es propia o publica (contrato: 404 si no existe o no es visible). */
  async detail(userId: string, routineId: string): Promise<RoutineDetail> {
    const [routine] = await this.db.query<{
      id: string;
      name: string;
      description: string | null;
      is_public: boolean;
    }>(
      `select id, name, description, is_public
       from public.routines
       where id = $1 and (owner_id = $2 or is_public)`,
      [routineId, userId],
    );
    if (!routine) throw new NotFoundException("Rutina no encontrada");

    const rows = await this.db.query<{
      id: string;
      exercise_id: string;
      exercise_name: string;
      muscle_group: RoutineDetail["exercises"][number]["muscle_group"];
      position: number;
      notes: string | null;
      set_position: number | null;
      target_reps: number | null;
      target_weight_kg: number | null;
      target_rpe: number | null;
    }>(
      `select re.id, re.exercise_id, e.name as exercise_name, e.muscle_group,
              re.position, re.notes,
              rs.position as set_position,
              rs.target_reps,
              rs.target_weight_kg::float8 as target_weight_kg,
              rs.target_rpe::float8 as target_rpe
       from public.routine_exercises re
       join public.exercises e on e.id = re.exercise_id
       left join public.routine_sets rs on rs.routine_exercise_id = re.id
       where re.routine_id = $1
       order by re.position, rs.position`,
      [routineId],
    );

    const byExercise = new Map<string, RoutineDetail["exercises"][number]>();
    for (const r of rows) {
      let ex = byExercise.get(r.id);
      if (!ex) {
        ex = {
          id: r.id,
          exercise_id: r.exercise_id,
          exercise_name: r.exercise_name,
          muscle_group: r.muscle_group,
          position: r.position,
          notes: r.notes,
          sets: [],
        };
        byExercise.set(r.id, ex);
      }
      if (r.set_position !== null) {
        ex.sets.push({
          position: r.set_position,
          target_reps: r.target_reps,
          target_weight_kg: r.target_weight_kg,
          target_rpe: r.target_rpe,
        });
      }
    }

    return { ...routine, exercises: [...byExercise.values()] };
  }

  async create(userId: string, role: AppRole, input: CreateRoutineInput): Promise<{ id: string }> {
    return this.db.tx(async (tx) => {
      await this.enforcePlanLimit(tx, userId, role);
      const {
        rows: [{ id }],
      } = await tx.query<{ id: string }>(
        `insert into public.routines (owner_id, name, description)
         values ($1, $2, $3) returning id`,
        [userId, input.name, input.description ?? null],
      );
      await this.insertChildren(tx, id, input);
      return { id };
    });
  }

  /** PUT = reemplazo completo de la plantilla (contrato §4). */
  async replace(userId: string, routineId: string, input: CreateRoutineInput): Promise<void> {
    await this.db.tx(async (tx) => {
      const owned = await tx.query(
        "select 1 from public.routines where id = $1 and owner_id = $2 for update",
        [routineId, userId],
      );
      if (!owned.rowCount) throw new NotFoundException("Rutina no encontrada");

      await tx.query(
        `update public.routines set name = $2, description = $3, updated_at = now() where id = $1`,
        [routineId, input.name, input.description ?? null],
      );
      await tx.query("delete from public.routine_exercises where routine_id = $1", [routineId]);
      await this.insertChildren(tx, routineId, input);
    });
  }

  async remove(userId: string, routineId: string): Promise<void> {
    await this.db.query("delete from public.routines where id = $1 and owner_id = $2", [
      routineId,
      userId,
    ]);
  }

  /* ===== Internos ===== */

  private async enforcePlanLimit(tx: PoolClient, userId: string, role: AppRole): Promise<void> {
    const max = PLAN_LIMITS[role].maxRoutines;
    if (!Number.isFinite(max)) return;
    const {
      rows: [{ n }],
    } = await tx.query<{ n: number }>(
      "select count(*)::int as n from public.routines where owner_id = $1",
      [userId],
    );
    if (n >= max) {
      // Contrato: 422 limite de plan alcanzado. El copy evita culpa (plan §8.2).
      throw new UnprocessableEntityException(
        `Tu plan permite hasta ${max} rutinas. Elimina una o pasa a PRO para crear más.`,
      );
    }
  }

  private async insertChildren(tx: PoolClient, routineId: string, input: CreateRoutineInput) {
    try {
      for (const ex of input.exercises) {
        const {
          rows: [{ id: reId }],
        } = await tx.query<{ id: string }>(
          `insert into public.routine_exercises (routine_id, exercise_id, position, notes)
           values ($1, $2, $3, $4) returning id`,
          [routineId, ex.exercise_id, ex.position, ex.notes ?? null],
        );
        for (const s of ex.sets) {
          await tx.query(
            `insert into public.routine_sets (routine_exercise_id, position, target_reps, target_weight_kg, target_rpe)
             values ($1, $2, $3, $4, $5)`,
            [reId, s.position, s.target_reps ?? null, s.target_weight_kg ?? null, s.target_rpe ?? null],
          );
        }
      }
    } catch (err) {
      // FK de exercise_id inexistente -> 400 legible en vez de 500.
      if ((err as { code?: string }).code === "23503") {
        throw new BadRequestException("Algún ejercicio de la rutina no existe en el catálogo");
      }
      throw err;
    }
  }
}
