/** Zona IANA del dispositivo (p. ej. "America/Mexico_City"); undefined si el runtime no la expone. */
export function zonaDelDispositivo(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
