/** Pasos de la rampa `--heat-1..4` (globals.css). 0 = sin series. */
export const HEAT_STEPS = 4;

/** Paso de color para `sets`, relativo al grupo mas trabajado del rango. */
export function heatStep(sets: number, max: number): number {
  if (sets <= 0 || max <= 0) return 0;
  return Math.min(Math.ceil((sets / max) * HEAT_STEPS), HEAT_STEPS);
}

/**
 * Rangos de series de cada paso para la leyenda, p. ej. max 16 ->
 * [1-4, 5-8, 9-12, 13-16]. Con max chico se omiten pasos vacios (enteros).
 */
export function heatLegend(max: number): { step: number; from: number; to: number }[] {
  if (max <= 0) return [];
  const out: { step: number; from: number; to: number }[] = [];
  for (let step = 1; step <= HEAT_STEPS; step++) {
    const from = Math.floor(((step - 1) * max) / HEAT_STEPS) + 1;
    const to = Math.floor((step * max) / HEAT_STEPS);
    if (from <= to) out.push({ step, from, to });
  }
  return out;
}
