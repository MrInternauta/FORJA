import { Injectable } from "@nestjs/common";
import type { WeeklyVolumePoint } from "@forja/shared";
import { DatabaseService } from "../database/database.service";

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
}
