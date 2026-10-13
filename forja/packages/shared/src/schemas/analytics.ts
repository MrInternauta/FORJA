import { z } from "zod";
import { ACHIEVEMENT_TIERS } from "../enums";

export const WeeklyVolumePointSchema = z.object({
  week_start: z.string(),
  volume_kg: z.number(),
  workouts: z.number().int(),
});
export type WeeklyVolumePoint = z.infer<typeof WeeklyVolumePointSchema>;

export const VolumeQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(12),
});

/* ---------- GET /analytics/distribution ---------- */

export const DISTRIBUTION_DIMENSIONS = ["muscle_group", "equipment"] as const;
export type DistributionDimension = (typeof DISTRIBUTION_DIMENSIONS)[number];

export const DistributionQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    by: z.enum(DISTRIBUTION_DIMENSIONS).default("muscle_group"),
  })
  .refine((q) => !q.from || !q.to || new Date(q.from) <= new Date(q.to), {
    message: "`from` debe ser anterior o igual a `to`",
    path: ["from"],
  });
export type DistributionQuery = z.infer<typeof DistributionQuerySchema>;

/** `key` es un MuscleGroup o un EquipmentType segun `by`. Solo el grupo PRIMARIO del ejercicio. */
export const DistributionPointSchema = z.object({
  key: z.string(),
  volume_kg: z.number(),
  sets: z.number().int(),
});
export type DistributionPoint = z.infer<typeof DistributionPointSchema>;

/* ---------- GET /analytics/prs ---------- */

/** 1RM estimado con Epley: peso x (1 + reps/30); con 1 rep es el propio peso; null con 0 reps. */
export const PersonalRecordSchema = z.object({
  exercise_id: z.string().uuid(),
  exercise_name: z.string(),
  muscle_group: z.string(),
  weight_kg: z.number(),
  reps: z.number().int(),
  estimated_1rm_kg: z.number().nullable(),
  achieved_at: z.string(),
  workout_id: z.string().uuid().nullable(),
});
export type PersonalRecord = z.infer<typeof PersonalRecordSchema>;

/* ---------- GET /analytics/exercise/:id/history ---------- */

export const ExerciseHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(30),
});

/** Un punto por sesion terminada en la que se completo al menos una serie del ejercicio. */
export const ExerciseHistoryPointSchema = z.object({
  workout_id: z.string().uuid(),
  started_at: z.string(),
  top_weight_kg: z.number(),
  top_reps: z.number().int(),
  estimated_1rm_kg: z.number().nullable(),
  volume_kg: z.number(),
  sets: z.number().int(),
});
export type ExerciseHistoryPoint = z.infer<typeof ExerciseHistoryPointSchema>;

export const ExerciseHistorySchema = z.object({
  exercise: z.object({ id: z.string().uuid(), name: z.string(), muscle_group: z.string() }),
  /** Orden cronologico ascendente (listo para graficar); las `limit` sesiones mas recientes. */
  points: z.array(ExerciseHistoryPointSchema),
});
export type ExerciseHistory = z.infer<typeof ExerciseHistorySchema>;

/* ---------- GET /analytics/weekly-summary ---------- */

/** `week` = lunes (UTC) de la semana a resumir; por defecto la ultima semana completa. */
export const WeeklySummaryQuerySchema = z.object({
  week: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD")
    .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "Fecha invalida")
    .refine((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1, "`week` debe ser un lunes")
    .optional(),
});

export const WeeklySummarySchema = z.object({
  week_start: z.string(),
  sessions: z.number().int(),
  weekly_goal: z.number().int(),
  goal_met: z.boolean(),
  volume_kg: z.number(),
  sets: z.number().int(),
  previous_volume_kg: z.number(),
  /** PRs vigentes cuya sesion cayo en la semana (un PR superado despues ya no aparece). */
  prs: z.array(
    z.object({
      exercise_id: z.string().uuid(),
      exercise_name: z.string(),
      weight_kg: z.number(),
      reps: z.number().int(),
    }),
  ),
  achievements: z.array(z.object({ id: z.string(), name: z.string(), tier: z.enum(ACHIEVEMENT_TIERS) })),
  current_streak: z.number().int(),
  /** true si la semana pedida es la ultima completa: la UI no ofrece "siguiente". */
  is_latest: z.boolean(),
});
export type WeeklySummary = z.infer<typeof WeeklySummarySchema>;
