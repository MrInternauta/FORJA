import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncOperation, SyncResponse, Workout } from "@forja/shared";

// El SW no existe en Node: el registro de Background Sync se neutraliza.
vi.mock("./background-sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./background-sync")>()),
  requestBackgroundSync: vi.fn(async () => false),
}));

const apiMock = vi.fn();
vi.mock("../api", () => ({
  api: (path: string, init?: unknown) => apiMock(path, init),
  ApiError: class ApiError extends Error {},
}));

import { discardLocalWorkout, localDb, upsertLocalWorkout } from "./db";
import { countPendingWorkouts, flushOutbox } from "./sync";
import { getSyncState, setSyncState } from "./sync-state";

const WORKOUT_ID = "11111111-1111-4111-8111-111111111111";

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: WORKOUT_ID,
    routine_id: null,
    title: "Empuje",
    notes: null,
    started_at: "2026-07-01T10:00:00.000Z",
    ended_at: "2026-07-01T11:00:00.000Z",
    client_updated_at: "2026-07-01T11:00:00.000Z",
    exercises: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        exercise_id: "33333333-3333-4333-8333-333333333333",
        position: 1,
        sets: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            position: 1,
            reps: 8,
            weight_kg: 80,
            rpe: null,
            is_completed: true,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function okResponse(ids: string[], status: "applied" | "skipped_stale" = "applied"): SyncResponse {
  return {
    results: ids.map((id) => ({ id, status })),
    rewards: { new_prs: [], new_achievements: [], streak_delta: 0 },
  };
}

/** Operaciones que viajaron en la n-esima llamada al endpoint de sync. */
function operationsOfCall(n: number): SyncOperation[] {
  return (apiMock.mock.calls[n][1] as { body: { operations: SyncOperation[] } }).body.operations;
}

beforeEach(async () => {
  apiMock.mockReset();
  await localDb.workouts.clear();
  await localDb.outbox.clear();
  setSyncState({ phase: "idle", pending: 0, online: true, lastSyncedAt: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("flushOutbox", () => {
  it("envia el workout y lo marca sincronizado", async () => {
    apiMock.mockResolvedValue(okResponse([WORKOUT_ID]));
    await upsertLocalWorkout(makeWorkout());

    const rewards = await flushOutbox();

    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(apiMock.mock.calls[0][0]).toBe("/sync/workouts");
    expect(rewards).toEqual({ new_prs: [], new_achievements: [], streak_delta: 0 });
    expect(await localDb.outbox.count()).toBe(0);
    expect((await localDb.workouts.get(WORKOUT_ID))?.sync_status).toBe("synced");
    expect(getSyncState().phase).toBe("idle");
  });

  it("compacta varias ediciones del mismo workout en una sola operacion", async () => {
    apiMock.mockResolvedValue(okResponse([WORKOUT_ID]));
    await upsertLocalWorkout(makeWorkout({ client_updated_at: "2026-07-01T11:00:00.000Z" }));
    await upsertLocalWorkout(makeWorkout({ client_updated_at: "2026-07-01T11:05:00.000Z" }));
    await upsertLocalWorkout(makeWorkout({ client_updated_at: "2026-07-01T11:09:00.000Z" }));

    expect(await localDb.outbox.count()).toBe(3);
    expect(await countPendingWorkouts()).toBe(1);

    await flushOutbox();

    // Solo viaja la ultima intencion (LWW en el cliente)...
    const ops = operationsOfCall(0);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: "upsert" });
    expect((ops[0] as { workout: Workout }).workout.client_updated_at).toBe("2026-07-01T11:09:00.000Z");
    // ...pero las 3 entradas cubiertas se limpian juntas.
    expect(await localDb.outbox.count()).toBe(0);
  });

  it("reintento: si el POST falla, nada se pierde y el siguiente flush lo sube", async () => {
    apiMock.mockRejectedValueOnce(new Error("network down"));
    await upsertLocalWorkout(makeWorkout());

    const first = await flushOutbox();

    expect(first).toBeNull();
    expect(await localDb.outbox.count()).toBe(1);
    expect((await localDb.workouts.get(WORKOUT_ID))?.sync_status).toBe("pending");
    expect(getSyncState().phase).toBe("error");
    expect(getSyncState().pending).toBe(1);

    apiMock.mockResolvedValueOnce(okResponse([WORKOUT_ID]));
    await flushOutbox();

    expect(await localDb.outbox.count()).toBe(0);
    expect((await localDb.workouts.get(WORKOUT_ID))?.sync_status).toBe("synced");
    expect(getSyncState().phase).toBe("idle");
    expect(getSyncState().pending).toBe(0);
  });

  it("duplicado: un reenvio idempotente responde skipped_stale y no reencola nada", async () => {
    apiMock.mockResolvedValue(okResponse([WORKOUT_ID]));
    await upsertLocalWorkout(makeWorkout());
    await flushOutbox();

    // Segundo flush sin cambios locales: no hay nada que enviar.
    apiMock.mockClear();
    const again = await flushOutbox();
    expect(again).toBeNull();
    expect(apiMock).not.toHaveBeenCalled();

    // Reenvio real del mismo documento (p. ej. tras recuperar la pestana):
    // el servidor lo declara obsoleto y el cliente igualmente limpia el outbox.
    apiMock.mockResolvedValue(okResponse([WORKOUT_ID], "skipped_stale"));
    await upsertLocalWorkout(makeWorkout());
    await flushOutbox();

    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(await localDb.outbox.count()).toBe(0);
    expect((await localDb.workouts.get(WORKOUT_ID))?.sync_status).toBe("synced");
  });

  it("borrado offline: el delete viaja aunque el workout ya no exista en local", async () => {
    apiMock.mockResolvedValue(okResponse([WORKOUT_ID]));
    await upsertLocalWorkout(makeWorkout());
    await discardLocalWorkout(WORKOUT_ID);

    expect(await localDb.workouts.get(WORKOUT_ID)).toBeUndefined();

    await flushOutbox();

    const ops = operationsOfCall(0);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      op: "delete",
      workout_id: WORKOUT_ID,
      client_updated_at: expect.any(String),
    });
    expect(await localDb.outbox.count()).toBe(0);
  });

  it("no pierde una serie completada mientras el POST estaba en vuelo", async () => {
    // Regresion: antes se borraba del outbox por `workout_id`, asi que la
    // confirmacion del POST en vuelo se llevaba por delante la serie que el
    // usuario acababa de completar. Ahora solo se borran los `seq` enviados.
    let releaseFirstPost!: (value: SyncResponse) => void;
    const firstPostSent = new Promise<void>((signalSent) => {
      apiMock.mockImplementationOnce(
        () =>
          new Promise<SyncResponse>((resolve) => {
            releaseFirstPost = resolve;
            signalSent();
          }),
      );
    });

    await upsertLocalWorkout(makeWorkout({ client_updated_at: "2026-07-01T11:00:00.000Z" }));
    const flushing = flushOutbox();
    await firstPostSent;

    // El usuario completa otra serie con el POST ya en vuelo.
    await upsertLocalWorkout(makeWorkout({ client_updated_at: "2026-07-01T11:30:00.000Z" }));

    releaseFirstPost(okResponse([WORKOUT_ID]));
    await flushing;

    // La intencion nueva sobrevive y el workout NO se declara sincronizado.
    expect(await localDb.outbox.count()).toBe(1);
    expect((await localDb.outbox.toArray())[0].client_updated_at).toBe("2026-07-01T11:30:00.000Z");
    expect((await localDb.workouts.get(WORKOUT_ID))?.sync_status).toBe("pending");

    // El siguiente flush la sube.
    apiMock.mockResolvedValue(okResponse([WORKOUT_ID]));
    await flushOutbox();

    const secondOps = operationsOfCall(1);
    expect((secondOps[0] as { workout: Workout }).workout.client_updated_at).toBe(
      "2026-07-01T11:30:00.000Z",
    );
    expect(await localDb.outbox.count()).toBe(0);
    expect((await localDb.workouts.get(WORKOUT_ID))?.sync_status).toBe("synced");
  });

  it("no lanza dos POST simultaneos del mismo outbox", async () => {
    apiMock.mockResolvedValue(okResponse([WORKOUT_ID]));
    await upsertLocalWorkout(makeWorkout());

    await Promise.all([flushOutbox(), flushOutbox(), flushOutbox()]);

    expect(apiMock).toHaveBeenCalledTimes(1);
  });

  it("sin conexion no intenta el POST y deja el outbox intacto", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await upsertLocalWorkout(makeWorkout());

    const result = await flushOutbox();

    expect(result).toBeNull();
    expect(apiMock).not.toHaveBeenCalled();
    expect(await localDb.outbox.count()).toBe(1);
    expect(getSyncState().online).toBe(false);
    expect(getSyncState().pending).toBe(1);
    vi.stubGlobal("navigator", { onLine: true });
  });
});
