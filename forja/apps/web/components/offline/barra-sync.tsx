"use client";

import { useSyncExternalStore } from "react";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { getServerSyncState, getSyncState, subscribeSyncState } from "@/lib/offline/sync-state";
import { flushOutbox } from "@/lib/offline/sync";

/**
 * `BarraSync` (plan §6.1 / gamificacion §8.2): franja discreta que solo aparece
 * cuando hay algo que decir. El copy nunca culpa ni alarma — entrenar sin
 * conexion es un caso soportado, no un error del usuario — y siempre afirma que
 * el trabajo esta guardado.
 */
export function BarraSync() {
  const state = useSyncExternalStore(subscribeSyncState, getSyncState, getServerSyncState);
  const { phase, pending, online } = state;

  if (pending === 0 && online && phase !== "error") return null;

  const sesiones = `${pending} ${pending === 1 ? "sesión" : "sesiones"}`;

  let Icon = RefreshCw;
  let tone = "text-[var(--fg-muted)]";
  let message: string;
  let spinning = false;

  if (!online) {
    Icon = CloudOff;
    message = pending > 0 ? `Sin conexión · ${sesiones} guardadas aquí` : "Sin conexión";
  } else if (phase === "syncing") {
    message = pending > 0 ? `Sincronizando ${sesiones}…` : "Sincronizando…";
    spinning = true;
  } else if (phase === "error") {
    Icon = TriangleAlert;
    tone = "text-[var(--warning)]";
    message = pending > 0 ? `${sesiones} pendientes de subir` : "Reintentando la sincronización";
  } else {
    message = `${sesiones} por sincronizar`;
  }

  const canRetry = online && phase !== "syncing" && pending > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky z-40 flex items-center justify-center gap-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-4 py-1.5 text-xs backdrop-blur-xl"
      style={{ top: "env(safe-area-inset-top)" }}
    >
      <Icon
        size={13}
        strokeWidth={2}
        aria-hidden
        className={`${tone} ${spinning ? "animate-spin" : ""}`}
      />
      <span className={tone}>{message}</span>
      {canRetry && (
        <button
          type="button"
          onClick={() => void flushOutbox()}
          className="ml-1 text-[var(--accent)] underline underline-offset-2"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
