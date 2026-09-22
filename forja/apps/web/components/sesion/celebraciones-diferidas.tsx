"use client";

import { useEffect, useState } from "react";
import { Flame, Medal } from "lucide-react";
import type { SyncRewards } from "@forja/shared";
import { TarjetaPR } from "@/components/sesion/tarjeta-pr";
import { achievementLabel } from "@/lib/labels";
import { subscribeRewards } from "@/lib/offline/sync-state";
import { Dialogo } from "@/components/ui/dialogo";

type Celebracion =
  | { kind: "pr"; key: string; exerciseName: string; weightKg: number; reps: number }
  | { kind: "achievement"; key: string; id: string }
  | { kind: "streak"; key: string; delta: number };

function toQueue(rewards: SyncRewards, stamp: number): Celebracion[] {
  const items: Celebracion[] = rewards.new_prs.map((pr, i) => ({
    kind: "pr",
    key: `${stamp}-pr-${pr.exercise_id}-${i}`,
    exerciseName: pr.exercise_name,
    weightKg: pr.weight_kg,
    reps: pr.reps,
  }));
  items.push(
    ...rewards.new_achievements.map((id, i) => ({
      kind: "achievement" as const,
      key: `${stamp}-logro-${id}-${i}`,
      id,
    })),
  );
  // Solo se celebra la racha que avanza; perderla nunca se anuncia (§8.2).
  if (rewards.streak_delta > 0) {
    items.push({ kind: "streak", key: `${stamp}-racha`, delta: rewards.streak_delta });
  }
  return items;
}

/**
 * Celebraciones diferidas (plan de diseno §8.3, semanas 10-11).
 *
 * Si entrenaste sin conexion, el backend no pudo calcular PRs, medallas ni
 * racha hasta el sync. Este componente vive en el shell — nunca en /sesion, que
 * ya celebra en su resumen — y descarga la cola una por una cuando el flush del
 * outbox trae recompensas: la ignicion te espera al reconectar.
 */
export function CelebracionesDiferidas() {
  const [queue, setQueue] = useState<Celebracion[]>([]);

  useEffect(
    () =>
      subscribeRewards((rewards) => {
        const stamp = Date.now();
        setQueue((prev) => [...prev, ...toQueue(rewards, stamp)]);
      }),
    [],
  );

  const current = queue[0];
  const dismiss = () => setQueue((q) => q.slice(1));

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
          {esRacha
            ? "Se registró mientras entrenabas sin conexión."
            : "Ganada con el trabajo que ya habías hecho."}
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
