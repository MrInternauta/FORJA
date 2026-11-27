/** Zona por defecto (mercado es-MX). Espejo del default de `profiles.time_zone` (migracion 0006). */
export const DEFAULT_TIME_ZONE = "America/Mexico_City";

/** true si el runtime (Intl) reconoce la zona IANA. Postgres puede no conocer alguna muy nueva: su trigger tiene la ultima palabra. */
export function esZonaHorariaValida(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
