import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateExerciseInput, Exercise, ExerciseFilters } from "@forja/shared";
import { DatabaseService } from "../database/database.service";

const PAGE_SIZE = 50;

@Injectable()
export class ExercisesService {
  constructor(private readonly db: DatabaseService) {}

  /** Keyset pagination por (name, id): estable aunque el ADMIN inserte en medio. */
  async list(filters: ExerciseFilters): Promise<{ items: Exercise[]; next_cursor: string | null }> {
    const where: string[] = ["is_active"];
    const params: unknown[] = [];

    if (filters.muscle_group) {
      params.push(filters.muscle_group);
      where.push(`muscle_group = $${params.length}`);
    }
    if (filters.equipment) {
      params.push(filters.equipment);
      where.push(`equipment = $${params.length}`);
    }
    if (filters.q) {
      params.push(`%${filters.q}%`);
      where.push(`name ilike $${params.length}`);
    }
    if (filters.cursor) {
      params.push(filters.cursor);
      where.push(
        `(name, id) > (select name, id from public.exercises where id = $${params.length})`,
      );
    }

    const items = await this.db.query<Exercise>(
      `select id, name, description, muscle_group, secondary_muscles, equipment, media_url, media_type
       from public.exercises
       where ${where.join(" and ")}
       order by name, id
       limit ${PAGE_SIZE}`,
      params,
    );
    return {
      items,
      next_cursor: items.length === PAGE_SIZE ? items[items.length - 1].id : null,
    };
  }

  async byId(id: string): Promise<Exercise> {
    const [row] = await this.db.query<Exercise>(
      `select id, name, description, muscle_group, secondary_muscles, equipment, media_url, media_type
       from public.exercises where id = $1 and is_active`,
      [id],
    );
    if (!row) throw new NotFoundException("Ejercicio no encontrado");
    return row;
  }

  async create(input: CreateExerciseInput): Promise<Exercise> {
    const [row] = await this.db.query<Exercise>(
      `insert into public.exercises (name, description, muscle_group, secondary_muscles, equipment, media_url, media_type)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, name, description, muscle_group, secondary_muscles, equipment, media_url, media_type`,
      [
        input.name,
        input.description ?? null,
        input.muscle_group,
        input.secondary_muscles,
        input.equipment,
        input.media_url ?? null,
        input.media_type ?? null,
      ],
    );
    return row;
  }

  async softDelete(id: string): Promise<void> {
    await this.db.query("update public.exercises set is_active = false where id = $1", [id]);
  }
}
