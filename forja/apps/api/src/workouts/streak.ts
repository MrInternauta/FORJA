/** Semanas que se miran hacia atras para la racha (2 anios). */
export const STREAK_WINDOW_WEEKS = 104;
/** Diseno §8: 1 semana de gracia ganada cada 4 semanas cumplidas (como un streak freeze, pero ganado). */
export const WEEKS_PER_GRACE = 4;

/**
 * Racha semanal y semanas de gracia, recorriendo la ventana de la mas vieja a la
 * actual. `sessionsByWeek` usa el lunes local `YYYY-MM-DD`; `currentWeek` es el
 * lunes de la semana en curso a medianoche UTC.
 *
 * - Semana cumplida: suma a la racha; cada 4 cumplidas de la racha, +1 gracia.
 * - Semana pasada sin cumplir: si hay gracia, se consume y la racha sigue (la
 *   semana puenteada no suma); si no, la racha vuelve a 0.
 * - La semana en curso solo suma si YA se cumplio: nunca rompe ni consume gracia.
 */
export function computeStreak(
  sessionsByWeek: Map<string, number>,
  currentWeek: Date,
  weeklyGoal: number,
): { streak: number; graceWeeks: number } {
  let streak = 0;
  let grace = 0;
  let metInStreak = 0;
  const meet = () => {
    streak++;
    metInStreak++;
    if (metInStreak % WEEKS_PER_GRACE === 0) grace++;
  };

  for (let i = STREAK_WINDOW_WEEKS; i >= 1; i--) {
    if ((sessionsByWeek.get(fmt(addWeeks(currentWeek, -i))) ?? 0) >= weeklyGoal) meet();
    else if (streak > 0 && grace > 0) grace--;
    else {
      streak = 0;
      grace = 0;
      metInStreak = 0;
    }
  }
  if ((sessionsByWeek.get(fmt(currentWeek)) ?? 0) >= weeklyGoal) meet();
  return { streak, graceWeeks: grace };
}

/* ===== Helpers de semana ISO (lunes, como fecha `YYYY-MM-DD` a medianoche UTC) ===== */
function addWeeks(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n * 7);
  return out;
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
