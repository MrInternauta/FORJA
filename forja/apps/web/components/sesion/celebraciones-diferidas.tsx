"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flame, Medal } from "lucide-react";
import { TarjetaPR } from "@/components/sesion/tarjeta-pr";
import { achievementLabel } from "@/lib/labels";
import { getSyncState, subscribeRewards, subscribeSyncState } from "@/lib/offline/sync-state";
import { confirmarRecompensas, encolar, leerPendientes, porConfirmar, type Celebracion } from "@/lib/offline/recompensas";
import { Dialogo } from "@/components/ui/dialogo";

/**
 * Celebraciones diferidas (plan de diseno §8.3).
 *
 * Si entrenaste sin conexion, el backend no pudo calcular PRs, medallas ni
 * racha hasta el sync. Este componente vive en el shell — nunca en /sesion, que
 * ya celebra sus PRs en el resumen — y descarga una por una las recompensas
 * PENDIENTES del servidor (GET /me/rewards). Las lee al montar, cuando un sync
 * trae recompensas y al terminar cada pasada de sync: aunque la respuesta del
 * sync se pierda (recarga, navegacion, red que cae), la ignicion te espera.
 * Cada una se confirma al cerrarla.
 */
export function CelebracionesDiferidas() {
  const [queue, setQueue] = useState<Celebracion[]>([]);
  const leyendo = useRef(false);

  const refrescar = useCallback(async () => {
    if (leyendo.current) return;
    leyendo.current = true;
    try {
      const pendientes = await leerPendientes();
      if (pendientes) setQueue((prev) => encolar(prev, pendientes, porConfirmar()));
    } finally {
      leyendo.current = false;
    }
  }, []);

  useEffect(() => {
    void refrescar();
    const offRewards = subscribeRewards(() => void refrescar());
    // Fin de una pasada de sync (syncing -> idle): cubre la respuesta perdida, cuyo reintento no trae recompensas.
    let fase = getSyncState().phase;
    const offSync = subscribeSyncState(() => {
      const nueva = getSyncState().phase;
      if (fase === "syncing" && nueva === "idle") void refrescar();
      fase = nueva;
    });
    return () => {
      offRewards();
      offSync();
    };
  }, [refrescar]);

  const current = queue[0];
  const dismiss = () => {
    if (current) void confirmarRecompensas([current.key]);
    setQueue((q) => q.slice(1));
  };

  if (!current) return null;

  if (current.kind === "pr") {
    return (
      <TarjetaPR
        key={current.key}
        exerciseName={current.exerciseName}
        weightKg={current.weightKg}
        reps={current.reps}
        onClose={dismiss}
      />
    );
  }

  return <TarjetaLogro key={current.key} item={current} onClose={dismiss} />;
}

function TarjetaLogro({
  item,
  onClose,
}: {
  item: Extract<Celebracion, { kind: "achievement" | "streak" }>;
  onClose: () => void;
}) {
  const esRacha = item.kind === "streak";
  const titulo = esRacha ? "RACHA VIVA" : "NUEVA MEDALLA";
  const nombre = esRacha
    ? `${item.delta === 1 ? "Una semana más" : `${item.delta} semanas más`} cumplidas`
    : achievementLabel(item.id);

  return (
    <Dialogo
      label={esRacha ? "Racha semanal cumplida" : "Nueva medalla"}
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="superficie flex w-full max-w-sm flex-col items-center gap-3 border-[var(--accent)] p-8 text-center"
      >
        <span className="texto-display text-sm tracking-widest text-[var(--accent)]">{titulo}</span>
        {esRacha ? (
          <Flame size={40} strokeWidth={1.5} className="text-[var(--ignicion-hasta)]" aria-hidden />
        ) : (
          <Medal size={40} strokeWidth={1.5} className="text-[var(--accent)]" aria-hidden />
        )}
        <p className="texto-display text-2xl text-[var(--fg)]">{nombre}</p>
        <p className="text-sm text-[var(--fg-muted)]">
          {esRacha ? "Cumpliste tu objetivo de la semana." : "Ganada con el trabajo que ya habías hecho."}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-semibold text-[var(--accent-contrast)]"
        >
          Continuar
        </button>
      </div>
    </Dialogo>
  );
}
