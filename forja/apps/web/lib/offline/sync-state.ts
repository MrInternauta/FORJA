"use client";

import type { SyncRewards } from "@forja/shared";

/**
 * Estado observable del outbox (semanas 10-11). Vive fuera de React para que
 * `flushOutbox` — que se dispara desde triggers del navegador y del Service
 * Worker, no desde un componente — pueda publicar sin acoplarse al arbol.
 * Se consume con `useSyncExternalStore` (ver `components/offline/barra-sync.tsx`).
 */
export interface SyncState {
  phase: "idle" | "syncing" | "error";
  /** Workouts distintos aun sin confirmar por el servidor. */
  pending: number;
  online: boolean;
  lastSyncedAt: string | null;
}

const INITIAL: SyncState = {
  phase: "idle",
  pending: 0,
  online: true,
  lastSyncedAt: null,
};

let current: SyncState = INITIAL;
const listeners = new Set<() => void>();

export function getSyncState(): SyncState {
  return current;
}

/** Snapshot para SSR: el outbox solo existe en el navegador. */
export function getServerSyncState(): SyncState {
  return INITIAL;
}

export function subscribeSyncState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSyncState(patch: Partial<SyncState>): void {
  const next = { ...current, ...patch };
  const changed = (Object.keys(next) as (keyof SyncState)[]).some((k) => next[k] !== current[k]);
  if (!changed) return;
  current = next;
  for (const l of listeners) l();
}

/* ===== Bus de recompensas diferidas (plan de diseno §8.3) ===== */

type RewardsListener = (rewards: SyncRewards) => void;
const rewardListeners = new Set<RewardsListener>();

/**
 * Si entrenaste sin conexion, la ignicion te espera al reconectar: `flushOutbox`
 * emite aqui las recompensas que devolvio el servidor y la UI del shell las
 * celebra cuando el usuario ya no esta en /sesion.
 */
export function subscribeRewards(listener: RewardsListener): () => void {
  rewardListeners.add(listener);
  return () => rewardListeners.delete(listener);
}

export function emitRewards(rewards: SyncRewards): void {
  if (
    rewards.new_prs.length === 0 &&
    rewards.new_achievements.length === 0 &&
    rewards.streak_delta === 0
  ) {
    return;
  }
  for (const l of rewardListeners) l(rewards);
}
