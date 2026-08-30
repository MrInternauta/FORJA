import { z } from "zod";

export const WeeklyVolumePointSchema = z.object({
  week_start: z.string(),
  volume_kg: z.number(),
  workouts: z.number().int(),
});
export type WeeklyVolumePoint = z.infer<typeof WeeklyVolumePointSchema>;

export const VolumeQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(12),
});
