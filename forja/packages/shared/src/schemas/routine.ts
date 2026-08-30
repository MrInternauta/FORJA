import { z } from "zod";
import { MUSCLE_GROUPS } from "../enums";

/* ===== Entrada (builder -> POST/PUT /routines) ===== */

export const RoutineSetInputSchema = z.object({
  position: z.number().int().min(1).max(50),
  target_reps: z.number().int().min(1).max(100).nullable().optional(),
  target_weight_kg: z.number().min(0).max(2000).nullable().optional(),
  target_rpe: z.number().min(1).max(10).nullable().optional(),
});
export type RoutineSetInput = z.infer<typeof RoutineSetInputSchema>;

export const RoutineExerciseInputSchema = z.object({
  exercise_id: z.string().uuid(),
  position: z.number().int().min(1).max(50),
  notes: z.string().max(300).nullable().optional(),
  sets: z.array(RoutineSetInputSchema).min(1).max(50),
});
export type RoutineExerciseInput = z.infer<typeof RoutineExerciseInputSchema>;

export const CreateRoutineSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
  exercises: z.array(RoutineExerciseInputSchema).min(1).max(50),
});
export type CreateRoutineInput = z.infer<typeof CreateRoutineSchema>;

/* ===== Salida ===== */

export const RoutineSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  exercise_count: z.number().int(),
  updated_at: z.string(),
});
export type RoutineSummary = z.infer<typeof RoutineSummarySchema>;

export const RoutineDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  is_public: z.boolean(),
  exercises: z.array(
    z.object({
      id: z.string().uuid(),
      exercise_id: z.string().uuid(),
      exercise_name: z.string(),
      muscle_group: z.enum(MUSCLE_GROUPS),
      position: z.number().int(),
      notes: z.string().nullable(),
      sets: z.array(
        z.object({
          position: z.number().int(),
          target_reps: z.number().int().nullable(),
          target_weight_kg: z.number().nullable(),
          target_rpe: z.number().nullable(),
        }),
      ),
    }),
  ),
});
export type RoutineDetail = z.infer<typeof RoutineDetailSchema>;
