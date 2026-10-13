import type { SyncState } from "./sync-state";

export type TonoSync = "offline" | "syncing" | "error" | "pending";

/**
 * Copy de la `BarraSync` (gamificacion §8.2): nunca culpa ni alarma y siempre
 * afirma que el trabajo esta guardado. `null` = no hay nada que decir.
 * El adjetivo concuerda con el numero ("1 sesión guardada", "2 sesiones guardadas").
 */
export function mensajeSync({
  phase,
  pending,
  online,
}: Pick<SyncState, "phase" | "pending" | "online">): { tono: TonoSync; message: string } | null {
  if (pending === 0 && online && phase !== "error") return null;

  const una = pending === 1;
  const sesiones = `${pending} ${una ? "sesión" : "sesiones"}`;

  if (!online) {
    return {
      tono: "offline",
      message: pending > 0 ? `Sin conexión · ${sesiones} ${una ? "guardada" : "guardadas"} aquí` : "Sin conexión",
    };
  }
  if (phase === "syncing") {
    return { tono: "syncing", message: pending > 0 ? `Sincronizando ${sesiones}…` : "Sincronizando…" };
  }
  if (phase === "error") {
    return {
      tono: "error",
      message:
        pending > 0 ? `${sesiones} ${una ? "pendiente" : "pendientes"} de subir` : "Reintentando la sincronización",
    };
  }
  return { tono: "pending", message: `${sesiones} por sincronizar` };
}
