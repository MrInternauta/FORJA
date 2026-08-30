import { z } from "zod";
import { APP_ROLES } from "../enums";

export const UsernameSchema = z
  .string()
  .regex(/^[a-z0-9_]{3,30}$/, "3-30 caracteres: minusculas, numeros o guion bajo");

export const OnboardingSchema = z.object({
  username: UsernameSchema,
  display_name: z.string().min(1).max(60).optional(),
});
export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  username: UsernameSchema,
  display_name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  role: z.enum(APP_ROLES),
  is_public: z.boolean(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const UserStatsSchema = z.object({
  weekly_goal: z.number().int().min(1).max(7),
  current_streak: z.number().int().min(0),
  longest_streak: z.number().int().min(0),
  grace_weeks: z.number().int().min(0),
  total_volume_kg: z.number().min(0),
  total_workouts: z.number().int().min(0),
});
export type UserStats = z.infer<typeof UserStatsSchema>;
