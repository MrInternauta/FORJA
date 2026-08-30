import { z } from "zod";
import { EQUIPMENT_TYPES, MUSCLE_GROUPS } from "../enums";

export const ExerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  muscle_group: z.enum(MUSCLE_GROUPS),
  secondary_muscles: z.array(z.enum(MUSCLE_GROUPS)),
  equipment: z.enum(EQUIPMENT_TYPES),
  media_url: z.string().nullable(),
  media_type: z.enum(["image", "video"]).nullable(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const CreateExerciseSchema = ExerciseSchema.omit({ id: true }).extend({
  description: z.string().optional(),
  secondary_muscles: z.array(z.enum(MUSCLE_GROUPS)).default([]),
  media_url: z.string().url().optional(),
  media_type: z.enum(["image", "video"]).optional(),
});
export type CreateExerciseInput = z.infer<typeof CreateExerciseSchema>;

export const ExerciseFiltersSchema = z.object({
  muscle_group: z.enum(MUSCLE_GROUPS).optional(),
  equipment: z.enum(EQUIPMENT_TYPES).optional(),
  q: z.string().min(1).max(60).optional(),
  cursor: z.string().uuid().optional(),
});
export type ExerciseFilters = z.infer<typeof ExerciseFiltersSchema>;
