import { z } from "zod";

/** Un set ejecutado. IDs generados por el CLIENTE (uuid v4) para sync idempotente. */
export const WorkoutSetSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().min(1).max(200),
  reps: z.number().int().min(0).max(200),
  weight_kg: z.number().min(0).max(2000),
  rpe: z.number().min(1).max(10).nullable().optional(),
  is_completed: z.boolean().default(true),
});
export type WorkoutSet = z.infer<typeof WorkoutSetSchema>;

export const WorkoutExerciseSchema = z.object({
  id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  position: z.number().int().min(1).max(100),
  sets: z.array(WorkoutSetSchema).min(1),
});
export type WorkoutExercise = z.infer<typeof WorkoutExerciseSchema>;

export const WorkoutSchema = z.object({
  id: z.string().uuid(),
  routine_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(120).default("Entrenamiento"),
  notes: z.string().max(2000).nullable().optional(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable().optional(),
  /** Reloj logico del cliente para Last-Write-Wins. */
  client_updated_at: z.string().datetime(),
  exercises: z.array(WorkoutExerciseSchema),
});
export type Workout = z.infer<typeof WorkoutSchema>;

/* ===== Sincronizacion offline (patron outbox) ===== */

export const SyncOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("upsert"), workout: WorkoutSchema }),
  z.object({
    op: z.literal("delete"),
    workout_id: z.string().uuid(),
    client_updated_at: z.string().datetime(),
  }),
]);
export type SyncOperation = z.infer<typeof SyncOperationSchema>;

export const SyncRequestSchema = z.object({
  operations: z.array(SyncOperationSchema).min(1).max(50),
});
export type SyncRequest = z.infer<typeof SyncRequestSchema>;

export const SyncItemResultSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["applied", "skipped_stale", "error"]),
  message: z.string().optional(),
});
export type SyncItemResult = z.infer<typeof SyncItemResultSchema>;

/** Recompensas calculadas por el backend al confirmar el sync (ver plan de diseno §8.3). */
export const SyncRewardsSchema = z.object({
  new_prs: z.array(
    z.object({
      exercise_id: z.string().uuid(),
      exercise_name: z.string(),
      weight_kg: z.number(),
      reps: z.number().int(),
    }),
  ),
  new_achievements: z.array(z.string()),
  streak_delta: z.number().int(),
});
export type SyncRewards = z.infer<typeof SyncRewardsSchema>;

export const SyncResponseSchema = z.object({
  results: z.array(SyncItemResultSchema),
  rewards: SyncRewardsSchema,
});
export type SyncResponse = z.infer<typeof SyncResponseSchema>;

/** Autocompletar el logger (plan §6.2) con el ultimo set completado de un ejercicio. */
export const ExerciseLastSetSchema = z.object({
  weight_kg: z.number(),
  reps: z.number().int(),
  rpe: z.number().nullable(),
});
export type ExerciseLastSet = z.infer<typeof ExerciseLastSetSchema>;
