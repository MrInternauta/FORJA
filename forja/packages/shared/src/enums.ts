/** Espejo exacto de los enums de PostgreSQL (supabase/migrations/0001_init.sql). */
export const APP_ROLES = ["ADMIN", "PRO", "FREE"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const MUSCLE_GROUPS = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms",
  "quads", "hamstrings", "glutes", "calves", "core", "full_body", "cardio",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT_TYPES = [
  "barbell", "dumbbell", "machine", "cable", "bodyweight",
  "kettlebell", "band", "cardio_machine", "other",
] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const SUBSCRIPTION_STATUSES = ["active", "past_due", "canceled", "incomplete"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const ACHIEVEMENT_TIERS = ["hierro", "bronce", "plata", "oro", "platino"] as const;
export type AchievementTier = (typeof ACHIEVEMENT_TIERS)[number];
