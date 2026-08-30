/**
 * Background Sync API (arquitectura §6, semanas 10-11).
 *
 * Al encolar una mutacion pedimos al navegador que despierte al Service Worker
 * cuando vuelva la conexion, aunque la pestana ya este cerrada. El SW no puede
 * hacer el POST por si mismo — el Bearer vive en la sesion de Supabase de la
 * pagina — asi que reenvia el aviso a los clientes abiertos y estos llaman a
 * `flushOutbox` (ver `app/sw.ts`). Los triggers de `registerSyncTriggers`
 * (online / visibilitychange / arranque) siguen siendo la red de seguridad en
 * navegadores sin soporte, Safari incluido.
 */

export const OUTBOX_SYNC_TAG = "forja-outbox";
export const FLUSH_MESSAGE = "forja-flush-outbox";

/** `SyncManager` no existe en Safari; se accede de forma estructural. */
type SyncRegister = { register: (tag: string) => Promise<void> };

export async function requestBackgroundSync(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as unknown as { sync?: SyncRegister }).sync;
    if (!sync) return false;
    await sync.register(OUTBOX_SYNC_TAG);
    return true;
  } catch {
    // Permiso denegado o sin soporte: los triggers normales bastan.
    return false;
  }
}
