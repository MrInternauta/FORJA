import type { SyncOperation, SyncResponse, SyncRewards } from "@forja/shared";
import { api } from "../api";
import { localDb, type OutboxEntry } from "./db";
import { FLUSH_MESSAGE } from "./background-sync";
import { emitRewards, getSyncState, setSyncState } from "./sync-state";

const BATCH_SIZE = 50;

function emptyRewards(): SyncRewards {
  return { new_prs: [], new_achievements: [], streak_delta: 0 };
}

/** Workouts distintos aun sin confirmar: lo que pinta la `BarraSync`. */
export async function countPendingWorkouts(): Promise<number> {
  const ids = new Set<string>();
  await localDb.outbox.each((e) => ids.add(e.workout_id));
  return ids.size;
}

async function publishPending(): Promise<number> {
  const pending = await countPendingWorkouts();
  setSyncState({ pending });
  return pending;
}

/**
 * Reconciliacion post-respuesta. Borra del outbox EXACTAMENTE las entradas que
 * viajaron y que el servidor confirmo (`applied` / `skipped_stale`), nunca por
 * `workout_id`: si el usuario completo otra serie mientras el POST estaba en
 * vuelo, esa entrada nueva es una intencion aun no enviada y debe sobrevivir.
 * Por el mismo motivo el workout solo pasa a `synced` cuando ya no le queda
 * ninguna entrada en el outbox.
 */
async function confirmSent(sentSeqs: Map<string, number[]>, confirmedIds: Set<string>): Promise<void> {
  const seqsToDelete: number[] = [];
  for (const id of confirmedIds) {
    seqsToDelete.push(...(sentSeqs.get(id) ?? []));
  }
  if (seqsToDelete.length === 0) return;

  await localDb.transaction("rw", localDb.outbox, localDb.workouts, async () => {
    await localDb.outbox.bulkDelete(seqsToDelete);
    for (const id of confirmedIds) {
      const stillQueued = await localDb.outbox.where("workout_id").equals(id).count();
      if (stillQueued === 0) {
        await localDb.workouts.update(id, { sync_status: "synced" });
      }
    }
    // TODO(conflictos): en `skipped_stale`, traer la copia del servidor y
    // reemplazar la local (GET /workouts/:id) — regla LWW del documento.
  });
}

let inFlight: Promise<SyncRewards | null> | null = null;
let rerunRequested = false;

/**
 * Flush del outbox (arquitectura §6, paso 3-4):
 * - Compacta operaciones por workout (solo viaja la ultima intencion).
 * - POST /sync/workouts en lotes de <= 50.
 * - Limpia del outbox SOLO las entradas enviadas y confirmadas.
 * - Devuelve las recompensas acumuladas y las emite al bus para las
 *   celebraciones diferidas (§8.3).
 *
 * Serializado: una sola pasada en vuelo a la vez. Si algo encola mientras
 * corre, se reencadena otra pasada al terminar en lugar de solaparse (dos POST
 * simultaneos del mismo workout pelearian por LWW sin ganar nada).
 */
export function flushOutbox(): Promise<SyncRewards | null> {
  if (inFlight) {
    rerunRequested = true;
    return inFlight;
  }
  inFlight = runFlush().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runFlush(): Promise<SyncRewards | null> {
  const entries = await localDb.outbox.orderBy("seq").toArray();
  if (entries.length === 0) {
    setSyncState({ phase: "idle", pending: 0 });
    return null;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setSyncState({ phase: "idle", online: false, pending: await countPendingWorkouts() });
    return null;
  }

  setSyncState({ phase: "syncing", pending: await countPendingWorkouts() });

  // Compactar: la ultima entrada por workout gana (LWW tambien en el cliente),
  // pero recordamos TODOS los seq que quedan cubiertos para borrarlos juntos.
  const latest = new Map<string, OutboxEntry>();
  const sentSeqs = new Map<string, number[]>();
  for (const e of entries) {
    latest.set(e.workout_id, e);
    const seqs = sentSeqs.get(e.workout_id) ?? [];
    if (e.seq !== undefined) seqs.push(e.seq);
    sentSeqs.set(e.workout_id, seqs);
  }

  const operations: SyncOperation[] = [...latest.values()].map((e) =>
    e.op === "delete"
      ? { op: "delete", workout_id: e.workout_id, client_updated_at: e.client_updated_at }
      : { op: "upsert", workout: e.payload! },
  );

  const rewards = emptyRewards();
  let anyConfirmed = false;

  try {
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const batch = operations.slice(i, i + BATCH_SIZE);
      const res = await api<SyncResponse>("/sync/workouts", {
        method: "POST",
        body: { operations: batch },
      });

      const confirmed = new Set(res.results.filter((r) => r.status !== "error").map((r) => r.id));
      if (confirmed.size > 0) anyConfirmed = true;
      await confirmSent(sentSeqs, confirmed);

      rewards.new_prs.push(...res.rewards.new_prs);
      rewards.new_achievements.push(...res.rewards.new_achievements);
      rewards.streak_delta += res.rewards.streak_delta;
    }
  } catch {
    // Sin red o token expirado: lo no confirmado sigue en el outbox y se
    // reintenta en el proximo trigger. No se pierde nada.
    setSyncState({
      phase: "error",
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      pending: await countPendingWorkouts(),
    });
    if (anyConfirmed) emitRewards(rewards);
    return anyConfirmed ? rewards : null;
  }

  const pending = await publishPending();
  setSyncState({ phase: "idle", online: true, lastSyncedAt: new Date().toISOString(), pending });
  emitRewards(rewards);

  if (rerunRequested) {
    rerunRequested = false;
    // Encolado durante el vuelo: nueva pasada para no dejarlo esperando al
    // proximo trigger del navegador.
    void Promise.resolve().then(() => flushOutbox());
  }

  return rewards;
}

/**
 * Registra todos los disparadores del flush: arranque, vuelta de conexion,
 * la app volviendo a primer plano y el aviso del Service Worker despertado por
 * Background Sync. Devuelve el limpiador.
 */
export function registerSyncTriggers(onRewards?: (r: SyncRewards) => void): () => void {
  const run = () => {
    void flushOutbox()
      .then((r) => {
        if (r) onRewards?.(r);
      })
      .catch(() => {
        /* sin red o token: se reintenta en el proximo trigger */
      });
  };

  const goOnline = () => {
    setSyncState({ online: true });
    run();
  };
  const goOffline = () => setSyncState({ online: false });
  const onVisible = () => {
    if (document.visibilityState === "visible") run();
  };
  const onSwMessage = (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === FLUSH_MESSAGE) run();
  };

  setSyncState({ online: navigator.onLine });
  void publishPending();

  window.addEventListener("online", goOnline);
  window.addEventListener("offline", goOffline);
  document.addEventListener("visibilitychange", onVisible);
  navigator.serviceWorker?.addEventListener("message", onSwMessage);
  run();

  return () => {
    window.removeEventListener("online", goOnline);
    window.removeEventListener("offline", goOffline);
    document.removeEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.removeEventListener("message", onSwMessage);
  };
}

export { getSyncState };
