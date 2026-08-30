/**
 * Limites de plan (arquitectura §5): una sola fuente de verdad.
 * El backend los APLICA (PlanLimitsService); el frontend solo los MUESTRA.
 */
export const PLAN_LIMITS = {
  FREE: { maxRoutines: 5 },
  PRO: { maxRoutines: Infinity },
  ADMIN: { maxRoutines: Infinity },
} as const;
