import { z } from "zod";
import { APP_ROLES } from "../enums";
import { esZonaHorariaValida } from "../zona-horaria";

export const UsernameSchema = z
  .string()
  .regex(/^[a-z0-9_]{3,30}$/, "3-30 caracteres: minusculas, numeros o guion bajo");

/** Zona IANA en la que se cortan las semanas del usuario (lunes 00:00 local). */
export const TimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(esZonaHorariaValida, "Zona horaria desconocida: usa un nombre IANA como America/Mexico_City");

export const OnboardingSchema = z.object({
  username: UsernameSchema,
  display_name: z.string().min(1).max(60).optional(),
  /** La del dispositivo; sin ella queda DEFAULT_TIME_ZONE. */
  time_zone: TimeZoneSchema.optional(),
});
export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  username: UsernameSchema,
  display_name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  role: z.enum(APP_ROLES),
  is_public: z.boolean(),
  time_zone: z.string(),
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
