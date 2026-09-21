import type { AchievementMetric, AchievementTier, EquipmentType, MuscleGroup } from "@forja/shared";

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Pecho",
  back: "Espalda",
  shoulders: "Hombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearms: "Antebrazos",
  quads: "Cuádriceps",
  hamstrings: "Femorales",
  glutes: "Glúteos",
  calves: "Pantorrillas",
  core: "Core",
  full_body: "Cuerpo completo",
  cardio: "Cardio",
};

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  barbell: "Barra",
  dumbbell: "Mancuernas",
  machine: "Máquina",
  cable: "Polea",
  bodyweight: "Peso corporal",
  kettlebell: "Kettlebell",
  band: "Banda",
  cardio_machine: "Máquina de cardio",
  other: "Otro",
};

/**
 * Logros sembrados en `supabase/migrations/00000000000002_auth_hook_gamification.sql`.
 * El backend solo devuelve el id en `rewards.new_achievements`; el nombre visible
 * vive aqui para poder celebrar sin una llamada extra.
 */
export const ACHIEVEMENT_LABELS: Record<string, string> = {
  primera_sesion: "Primer golpe",
  sesiones_10: "Ritmo constante",
  sesiones_50: "Oficio",
  sesiones_100: "Centenario",
  sesiones_365: "Un año de forja",
  volumen_10k: "10 toneladas",
  volumen_100k: "100 toneladas",
  volumen_500k: "Medio millón",
  volumen_1m: "Millón forjado",
  racha_4: "Un mes al fuego",
  racha_12: "Trimestre sólido",
  racha_26: "Medio año",
  racha_52: "Año inquebrantable",
  primer_pr: "Primera marca",
  prs_25: "Coleccionista",
};

export const achievementLabel = (id: string): string => ACHIEVEMENT_LABELS[id] ?? "Nuevo logro";

export const TIER_LABELS: Record<AchievementTier, string> = {
  hierro: "Hierro",
  bronce: "Bronce",
  plata: "Plata",
  oro: "Oro",
  platino: "Platino",
};

/** Categorias de la vitrina de medallas, en su orden de aparicion. */
export const METRIC_LABELS: Record<AchievementMetric, string> = {
  workouts: "Sesiones",
  volume_kg: "Volumen",
  streak_weeks: "Racha semanal",
  prs: "Récords",
};
