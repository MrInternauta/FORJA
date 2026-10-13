const DAY_MS = 86_400_000;
const rtf = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });
// "el año pasado" mentiria para un PR de hace 15 meses: los anios siempre en numero.
const rtfNum = new Intl.RelativeTimeFormat("es-MX", { numeric: "always" });

/** Dias de calendario (locales) entre dos fechas: ayer a las 23:59 es "ayer", no "hoy". */
function calendarDays(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / DAY_MS);
}

/** "hoy", "ayer", "hace 3 días", "hace 2 semanas", "hace 4 meses", "hace 1 año". */
export function haceCuanto(iso: string, now = new Date()): string {
  const days = Math.max(calendarDays(new Date(iso), now), 0);
  if (days < 14) return rtf.format(-days, "day");
  if (days < 60) return rtf.format(-Math.floor(days / 7), "week");
  if (days < 365) return rtf.format(-Math.floor(days / 30), "month");
  return rtfNum.format(-Math.floor(days / 365), "year");
}

const kg = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

/** 82.5 -> "82.5"; 140 -> "140". */
export const formatPeso = (weightKg: number) => kg.format(weightKg);
