import { DESCANSO_CANCEL_MESSAGE, DESCANSO_MESSAGE } from "@/lib/offline/descanso-sw";

const AVISO = { title: "Descanso terminado", body: "Es hora de la siguiente serie.", tag: "forja-descanso" };

/** Postea la hora limite al SW (unico notificador). Devuelve si habia controlador. */
export function programarAvisoDescanso(endsAt: number): boolean {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return false;
  navigator.serviceWorker.controller.postMessage({ type: DESCANSO_MESSAGE, endsAt });
  return true;
}

export function cancelarAvisoDescanso(): void {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({ type: DESCANSO_CANCEL_MESSAGE });
}

/**
 * Sin SW (dev, SW desactivado): avisa desde la pagina, solo si esta oculta y el
 * permiso esta concedido. Android Chrome no permite `new Notification` — se
 * prefiere `registration.showNotification` y el constructor queda de ultimo recurso.
 */
export async function avisoDescansoSinSw(): Promise<void> {
  if (typeof document === "undefined" || !document.hidden) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) {
      await reg.showNotification(AVISO.title, { body: AVISO.body, tag: AVISO.tag });
      return;
    }
  } catch {
    // Sigue al ultimo recurso.
  }
  try {
    new Notification(AVISO.title, { body: AVISO.body, tag: AVISO.tag });
  } catch {
    // "Illegal constructor" en Android Chrome: no hay forma de avisar.
  }
}
