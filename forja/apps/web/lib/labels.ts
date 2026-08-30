import type { EquipmentType, MuscleGroup } from "@forja/shared";

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
