import type { SyncOperation, SyncResponse } from "@forja/shared";
import { api } from "../api";
import { localDb } from "./db";

/**
 * Flush del outbox (arquitectura §6, paso 3-4):
 * - Compacta operaciones por workout (solo viaja la ultima intencion).
 * - POST /sync/workouts en lotes de <= 50.
 * - Limpia del outbox SOLO lo confirmado (`applied` / `skipped_stale`).
 * - Devuelve las recompensas acumuladas para disparar celebraciones diferidas:
 *   si entrenaste offline, la ignicion te espera al reconectar (§8.3).
 */
export async function flushOutbox(): Promise<SyncResponse["rewards"] | null> {
  const entries = await localDb.outbox.orderBy("seq").toArray();
  if (entries.length === 0) return null;

  // Compactar: la ultima entrada por workout gana (LWW tambien en el cliente).
  const latest = new Map<string, (typeof entries)[number]>();
  for (const e of entries) latest.set(e.workout_id, e);

  const operations: SyncOperation[] = [...latest.values()].map((e) =>
    e.op === "delete"
      ? { op: "delete", workout_id: e.workout_id, client_updated_at: e.client_updated_at }
      : { op: "upsert", workout: e.payload! },
  );

  const rewards = { new_prs: [] as SyncResponse["rewards"]["new_prs"], new_achievements: [] as string[], streak_delta: 0 };

  for (let i = 0; i < operations.length; i += 50) {
    const batch = operations.slice(i, i + 50);
    const res = await api<SyncResponse>("/sync/workouts", { method: "POST", body: { operations: batch } });

    const confirmed = new Set(
      res.results.filter((r) => r.status !== "error").map((r) => r.id),
    );
    await localDb.transaction("rw", localDb.outbox, localDb.workouts, async () => {
      await localDb.outbox.where("workout_id").anyOf([...confirmed]).delete();
      for (const id of confirmed) {
        await localDb.workouts.update(id, { sync_status: "synced" });
      }
      // TODO(conflictos): en `skipped_stale`, traer la copia del servidor y
      // reemplazar la local (GET /workouts/:id) — regla LWW del documento.
    });

    rewards.new_prs.push(...res.rewards.new_prs);
    rewards.new_achievements.push(...res.rewards.new_achievements);
    rewards.streak_delta += res.rewards.streak_delta;
  }

  return rewards;
}

/** Registra el flush automatico al recuperar conexion y al abrir la app. */
export function registerSyncTriggers(onRewards?: (r: SyncResponse["rewards"]) => void) {
  const run = () =>
    flushOutbox()
      .then((r) => r && onRewards?.(r))
      .catch(() => {
        /* sin red o token: se reintenta en el proximo trigger */
      });
  window.addEventListener("online", run);
  run();
  return () => window.removeEventListener("online", run);
}
