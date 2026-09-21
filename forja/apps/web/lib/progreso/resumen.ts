import type { WeeklySummary } from "@forja/shared";

/** `2026-09-14` + delta semanas, en UTC (mismas semanas que el backend). */
export function shiftWeek(weekStart: string, delta: number): string {
  return new Date(Date.parse(`${weekStart}T00:00:00Z`) + delta * 7 * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Frase del resumen. Copy sin culpa (§8.2): una semana corta o de descanso
 * nunca se presenta como fallo; el descanso es parte del entrenamiento.
 */
export function resumenCopy(s: Pick<WeeklySummary, "sessions" | "weekly_goal" | "goal_met">): string {
  if (s.goal_met) return `Semana cumplida: ${s.sessions} ${s.sessions === 1 ? "sesión" : "sesiones"} (objetivo: ${s.weekly_goal}).`;
  if (s.sessions > 0) return `${s.sessions} de ${s.weekly_goal} ${s.weekly_goal === 1 ? "sesión" : "sesiones"}. Cada una suma.`;
  return "Semana de descanso. El descanso también es parte del entrenamiento.";
}

export type Comparacion = { kind: "sube"; pct: number } | { kind: "baja"; anterior: number } | null;

/**
 * Contra tu yo de la semana anterior. Si baja no se muestra un % negativo, solo
 * la referencia (mismo criterio que la tarjeta de volumen). Sin base, nada.
 */
export function compararVolumen(actual: number, anterior: number): Comparacion {
  if (anterior <= 0) return null;
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  return pct >= 0 ? { kind: "sube", pct } : { kind: "baja", anterior };
}
