import type { WeeklyVolumePoint } from "@forja/shared";

/** Rangos del selector de Progreso (wireframe §6.2: [4s] [12s]). */
export const RANGOS_SEMANAS = [4, 12] as const;
export type RangoSemanas = (typeof RANGOS_SEMANAS)[number];

const DAY_MS = 86_400_000;

/**
 * Lunes 00:00 UTC de la semana ISO de `date`, como `YYYY-MM-DD`. Debe coincidir
 * con `date_trunc('week', ...)` del backend, que agrupa en UTC.
 */
export function weekKey(date: Date): string {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const day = new Date(utc).getUTCDay() || 7;
  return new Date(utc - (day - 1) * DAY_MS).toISOString().slice(0, 10);
}

/**
 * La API solo devuelve semanas con sesiones; la grafica necesita todas.
 * Devuelve exactamente `weeks` puntos, de la mas antigua a la actual, con ceros.
 */
export function fillWeeks(points: WeeklyVolumePoint[], weeks: number, now = new Date()): WeeklyVolumePoint[] {
  const byWeek = new Map(points.map((p) => [p.week_start, p]));
  const current = Date.parse(`${weekKey(now)}T00:00:00Z`);
  return Array.from({ length: weeks }, (_, i) => {
    const key = new Date(current - (weeks - 1 - i) * 7 * DAY_MS).toISOString().slice(0, 10);
    return byWeek.get(key) ?? { week_start: key, volume_kg: 0, workouts: 0 };
  });
}

/**
 * % de cambio de la semana actual contra la anterior, redondeado. null cuando
 * no hay base con que comparar (semana pasada sin volumen).
 */
export function weekOverWeek(filled: WeeklyVolumePoint[]): number | null {
  if (filled.length < 2) return null;
  const prev = filled[filled.length - 2].volume_kg;
  const curr = filled[filled.length - 1].volume_kg;
  if (prev <= 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

/** Tope "redondo" del eje Y y sus marcas (0 incluido), p. ej. 8,420 -> [0, 2500, 5000, 7500, 10000]. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rawStep = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep)!;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

const kgFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
const kgCompact = new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 });
const weekFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });

export const formatKg = (kg: number) => `${kgFormat.format(Math.round(kg))} kg`;
export const formatKgCompact = (kg: number) => kgCompact.format(kg);
/** `2026-09-14` -> "14 sept". */
export const formatWeek = (weekStart: string) => weekFormat.format(new Date(`${weekStart}T00:00:00Z`));
