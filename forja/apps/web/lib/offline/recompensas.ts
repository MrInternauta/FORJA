import type { PendingReward } from "@forja/shared";
import { api } from "@/lib/api";

/**
 * Recompensas pendientes de celebrar (plan §8.3). La fuente es el servidor
 * (GET /me/rewards), no la respuesta del sync: si esa respuesta se pierde, la
 * recompensa sigue esperando. Al mostrarla se confirma (POST /me/rewards/ack).
 *
 * Entrega "al menos una vez". Para no repetir una celebración cuya
 * confirmación falló (p. ej. sin conexión), sus ids se recuerdan en
 * localStorage, se ocultan y se reintenta confirmarlos en la siguiente lectura.
 */

export type Celebracion =
  | { kind: "pr"; key: string; exerciseName: string; weightKg: number; reps: number }
  | { kind: "achievement"; key: string; id: string }
  | { kind: "streak"; key: string; delta: number };

/** La key ES el id de la recompensa en el servidor: sirve para deduplicar y confirmar. */
export function aCelebracion(r: PendingReward): Celebracion {
  switch (r.kind) {
    case "pr":
      return { kind: "pr", key: r.id, exerciseName: r.payload.exercise_name, weightKg: r.payload.weight_kg, reps: r.payload.reps };
    case "achievement":
      return { kind: "achievement", key: r.id, id: r.payload.id };
    case "streak":
      return { kind: "streak", key: r.id, delta: r.payload.delta };
  }
}

/** Añade a la cola las recompensas que no estén ya en ella ni confirmadas localmente. Conserva el orden del servidor. */
export function encolar(cola: Celebracion[], pendientes: PendingReward[], confirmadas: ReadonlySet<string>): Celebracion[] {
  const enCola = new Set(cola.map((c) => c.key));
  const nuevas = pendientes.filter((r) => !enCola.has(r.id) && !confirmadas.has(r.id)).map(aCelebracion);
  return nuevas.length ? [...cola, ...nuevas] : cola;
}

/* ===== Confirmaciones con reintento ===== */

const STORAGE_KEY = "forja:recompensas-por-confirmar";

function leerPorConfirmar(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function guardarPorConfirmar(ids: string[]): void {
  try {
    if (ids.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-100)));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sin storage: el peor caso es volver a ver una celebración */
  }
}

/** Ids ya mostrados cuya confirmación aún no llegó al servidor. */
export function porConfirmar(): ReadonlySet<string> {
  return new Set(leerPorConfirmar());
}

/** Marca como vistas. Nunca lanza: si falla, quedan para el siguiente intento. */
export async function confirmarRecompensas(ids: string[]): Promise<void> {
  const todas = [...new Set([...leerPorConfirmar(), ...ids])];
  if (todas.length === 0) return;
  guardarPorConfirmar(todas);
  try {
    await api("/me/rewards/ack", { method: "POST", body: { ids: todas } });
    const restantes = leerPorConfirmar().filter((id) => !todas.includes(id));
    guardarPorConfirmar(restantes);
  } catch {
    /* offline o error: se reintenta en la próxima lectura */
  }
}

/** Pendientes del servidor menos las ya mostradas; de paso reintenta confirmaciones atrasadas. `null` si no hay red. */
export async function leerPendientes(): Promise<PendingReward[] | null> {
  if (leerPorConfirmar().length) await confirmarRecompensas([]);
  try {
    const pendientes = await api<PendingReward[]>("/me/rewards");
    const ocultas = porConfirmar();
    return pendientes.filter((r) => !ocultas.has(r.id));
  } catch {
    return null;
  }
}

/* ===== Resumen de /sesion ===== */

export type TarjetaPrResumen = Extract<Celebracion, { kind: "pr" }> & { confirmar: boolean };

/**
 * Tarjetas de PR del resumen de /sesion. Con las pendientes del servidor, cada
 * tarjeta se confirma al cerrarla (y el shell ya no la repite); sin red para
 * leerlas, se muestran las de la respuesta del sync sin confirmar: el shell las
 * volverá a celebrar más tarde, que es mejor que perderlas.
 * Medallas y racha no van aquí: las celebra el shell al volver a Hoy.
 */
export function prsDelResumen(
  pendientes: PendingReward[] | null,
  respuesta: { exercise_id: string; exercise_name: string; weight_kg: number; reps: number }[],
): TarjetaPrResumen[] {
  if (pendientes) {
    return pendientes.flatMap((r) => {
      const c = aCelebracion(r);
      return c.kind === "pr" ? [{ ...c, confirmar: true }] : [];
    });
  }
  return respuesta.map((pr) => ({
    kind: "pr",
    key: `respuesta-${pr.exercise_id}`,
    exerciseName: pr.exercise_name,
    weightKg: pr.weight_kg,
    reps: pr.reps,
    confirmar: false,
  }));
}
