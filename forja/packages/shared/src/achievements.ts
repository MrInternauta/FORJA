/**
 * Reglas de logros: fuente unica para OTORGAR (backend, al sincronizar) y para
 * mostrar el PROGRESO de los bloqueados en la vitrina. Los ids replican los
 * sembrados en `supabase/migrations/00000000000002_auth_hook_gamification.sql`.
 */
export const ACHIEVEMENT_METRICS = ["workouts", "volume_kg", "streak_weeks", "prs"] as const;
export type AchievementMetric = (typeof ACHIEVEMENT_METRICS)[number];

export interface AchievementRule {
  metric: AchievementMetric;
  target: number;
  /**
   * false = aun no medible: `prs_25` necesita un log de eventos de PR (hoy solo
   * existe el PR vigente por ejercicio). Ni se otorga ni muestra progreso.
   */
  measurable?: false;
}

export const ACHIEVEMENT_RULES: Record<string, AchievementRule> = {
  primera_sesion: { metric: "workouts", target: 1 },
  sesiones_10: { metric: "workouts", target: 10 },
  sesiones_50: { metric: "workouts", target: 50 },
  sesiones_100: { metric: "workouts", target: 100 },
  sesiones_365: { metric: "workouts", target: 365 },
  volumen_10k: { metric: "volume_kg", target: 10_000 },
  volumen_100k: { metric: "volume_kg", target: 100_000 },
  volumen_500k: { metric: "volume_kg", target: 500_000 },
  volumen_1m: { metric: "volume_kg", target: 1_000_000 },
  // La racha se mide con la MAS LARGA: una medalla ganada no se "pierde".
  racha_4: { metric: "streak_weeks", target: 4 },
  racha_12: { metric: "streak_weeks", target: 12 },
  racha_26: { metric: "streak_weeks", target: 26 },
  racha_52: { metric: "streak_weeks", target: 52 },
  primer_pr: { metric: "prs", target: 1 },
  prs_25: { metric: "prs", target: 25, measurable: false }, // TODO('prs_25'): log de eventos de PR
};

export type AchievementMetricValues = Record<AchievementMetric, number>;

/** Ids cuya regla ya se cumple con estos valores. */
export function eligibleAchievements(values: AchievementMetricValues): string[] {
  return Object.entries(ACHIEVEMENT_RULES)
    .filter(([, rule]) => rule.measurable !== false && values[rule.metric] >= rule.target)
    .map(([id]) => id);
}
