import type { WeeklyVolumePoint, Workout } from "@forja/shared";

/** Rangos del selector de Progreso (wireframe §6.2: [4s] [12s]). */
export const RANGOS_SEMANAS = [4, 12] as const;
export type RangoSemanas = (typeof RANGOS_SEMANAS)[number];

const DAY_MS = 86_400_000;

/** Un formateador por zona: crearlos es lo caro y Hoy calcula la semana de cada sesion. */
const fechaFormat = new Map<string, Intl.DateTimeFormat>();

/** Fecha local `YYYY-MM-DD` de `date` en `timeZone`. */
function fechaEnZona(date: Date, timeZone: string): string {
  let format = fechaFormat.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    fechaFormat.set(timeZone, format);
  }
  const parts = Object.fromEntries(format.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Lunes de la semana ISO de `date` en la zona del usuario, como `YYYY-MM-DD`. Debe
 * coincidir con `date_trunc('week', started_at at time zone ...)` del backend.
 */
export function weekKey(date: Date, timeZone: string): string {
  const utc = Date.parse(`${fechaEnZona(date, timeZone)}T00:00:00Z`);
  const day = new Date(utc).getUTCDay() || 7;
  return new Date(utc - (day - 1) * DAY_MS).toISOString().slice(0, 10);
}

/**
 * La API solo devuelve semanas con sesiones; la grafica necesita todas.
 * Devuelve exactamente `weeks` puntos, de la mas antigua a la actual, con ceros.
 */
export function fillWeeks(
  points: WeeklyVolumePoint[],
  weeks: number,
  timeZone: string,
  now = new Date(),
): WeeklyVolumePoint[] {
  const byWeek = new Map(points.map((p) => [p.week_start, p]));
  const current = Date.parse(`${weekKey(now, timeZone)}T00:00:00Z`);
  return Array.from({ length: weeks }, (_, i) => {
    const key = new Date(current - (weeks - 1 - i) * 7 * DAY_MS).toISOString().slice(0, 10);
    return byWeek.get(key) ?? { week_start: key, volume_kg: 0, workouts: 0 };
  });
}

/** Lo que una sesion local aporta a la grafica: su semana sale de `started_at`, como en el backend. */
export interface VolumenLocal {
  started_at: string;
  volume_kg: number;
}

/** kg x reps de las series completadas (mismo calculo que `GET /analytics/volume`). */
export function volumenDeSesion(workout: Workout): number {
  return workout.exercises
    .flatMap((ex) => ex.sets)
    .filter((st) => st.is_completed)
    .reduce((sum, st) => sum + st.weight_kg * st.reps, 0);
}

/**
 * Suma a los puntos de la API las sesiones locales que la red aun no cuenta
 * (cada una en la semana de su `started_at` en la zona del usuario). Antes de
 * `fillWeeks`, que descarta las semanas fuera del rango.
 */
export function sumarVolumenLocal(
  points: WeeklyVolumePoint[],
  locales: VolumenLocal[],
  timeZone: string,
): WeeklyVolumePoint[] {
  const byWeek = new Map(points.map((p) => [p.week_start, { ...p }]));
  for (const w of locales) {
    const key = weekKey(new Date(w.started_at), timeZone);
    const point = byWeek.get(key) ?? { week_start: key, volume_kg: 0, workouts: 0 };
    point.volume_kg += w.volume_kg;
    point.workouts += 1;
    byWeek.set(key, point);
  }
  return [...byWeek.values()].sort((a, b) => a.week_start.localeCompare(b.week_start));
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
