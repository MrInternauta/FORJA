/** Segundos enteros que faltan hasta `endsAt`; nunca negativo, redondea hacia arriba el segundo parcial. */
export function restante(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** Nueva fecha limite tras un ajuste de ±`deltaSeconds`; nunca queda antes de `now`. */
export function ajustar(endsAt: number, now: number, deltaSeconds: number): number {
  return Math.max(now, endsAt + deltaSeconds * 1000);
}
