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
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

import { ApiError } from "../api";
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

/**
 * Responde el POST de sync con `syncResponse` y `GET /workouts/:id` con `serverCopy`
 * (una funcion para simular red caida, 404 o una edicion local durante la descarga).
 */
function routeApi(syncResponse: SyncResponse, serverCopy: Workout | (() => Promise<Workout>)) {
  apiMock.mockImplementation(async (path: string) => {
    if (path === "/sync/workouts") return syncResponse;
    if (path === `/workouts/${WORKOUT_ID}`) return typeof serverCopy === "function" ? serverCopy() : serverCopy;
    throw new Error(`ruta inesperada ${path}`);
  });
}

/** Rutas pedidas a la API, en orden. */
const calledPaths = () => apiMock.mock.calls.map((c) => c[0] as string);

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
    routeApi(okResponse([WORKOUT_ID], "skipped_stale"), makeWorkout());
    await upsertLocalWorkout(makeWorkout());
    await flushOutbox();

    expect(calledPaths()).toEqual(["/sync/workouts", `/workouts/${WORKOUT_ID}`]);
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

describe("flushOutbox: skipped_stale (LWW, gana el servidor)", () => {
  // Otro dispositivo guardo una version mas nueva: menos series y otro titulo.
  const serverCopy = makeWorkout({
    title: "Empuje (desde la tablet)",
    client_updated_at: "2026-07-01T12:00:00.000Z",
    exercises: [],
  });

  it("reemplaza la copia local con la del servidor", async () => {
    routeApi(okResponse([WORKOUT_ID], "skipped_stale"), serverCopy);
    await upsertLocalWorkout(makeWorkout());

    await flushOutbox();

    expect(calledPaths()).toEqual(["/sync/workouts", `/workouts/${WORKOUT_ID}`]);
    expect(await localDb.workouts.get(WORKOUT_ID)).toEqual({ ...serverCopy, sync_status: "synced" });
    expect(await localDb.outbox.count()).toBe(0);
    expect(getSyncState().phase).toBe("idle");
  });

  it("NO pisa la copia local si el usuario edito mientras el POST estaba en vuelo", async () => {
    let releasePost!: (value: SyncResponse) => void;
    const postSent = new Promise<void>((signalSent) => {
      apiMock.mockImplementation(async (path: string) => {
        if (path !== "/sync/workouts") return serverCopy;
        return new Promise<SyncResponse>((resolve) => {
          releasePost = resolve;
          signalSent();
        });
      });
    });

    await upsertLocalWorkout(makeWorkout({ client_updated_at: "2026-07-01T11:00:00.000Z" }));
    const flushing = flushOutbox();
    await postSent;
    const edit = makeWorkout({ title: "Empuje + 1 serie", client_updated_at: "2026-07-01T12:30:00.000Z" });
    await upsertLocalWorkout(edit);

    releasePost(okResponse([WORKOUT_ID], "skipped_stale"));
    await flushing;

    // La edicion local sigue intacta y pendiente: viaja en la siguiente pasada y el LWW del servidor decide.
    expect(await localDb.workouts.get(WORKOUT_ID)).toEqual({ ...edit, sync_status: "pending" });
    expect((await localDb.outbox.toArray()).map((e) => e.client_updated_at)).toEqual(["2026-07-01T12:30:00.000Z"]);

    routeApi(okResponse([WORKOUT_ID]), serverCopy);
    await flushOutbox();
    expect((operationsOfCall(2)[0] as { workout: Workout }).workout.title).toBe("Empuje + 1 serie");
    expect(await localDb.workouts.get(WORKOUT_ID)).toEqual({ ...edit, sync_status: "synced" });
  });

  it("NO pisa la copia local si el usuario edito mientras se descargaba la del servidor", async () => {
    const edit = makeWorkout({ title: "Editada durante el GET", client_updated_at: "2026-07-01T12:30:00.000Z" });
    routeApi(okResponse([WORKOUT_ID], "skipped_stale"), async () => {
      await upsertLocalWorkout(edit);
      return serverCopy;
    });
    await upsertLocalWorkout(makeWorkout());

    await flushOutbox();

    expect(await localDb.workouts.get(WORKOUT_ID)).toEqual({ ...edit, sync_status: "pending" });
    expect(await localDb.outbox.count()).toBe(1);
    expect((await localDb.outbox.toArray())[0].client_updated_at).toBe("2026-07-01T12:30:00.000Z");
  });

  it("NO resucita un workout descartado mientras se descargaba la del servidor", async () => {
    routeApi(okResponse([WORKOUT_ID], "skipped_stale"), async () => {
      await discardLocalWorkout(WORKOUT_ID);
      return serverCopy;
    });
    await upsertLocalWorkout(makeWorkout());

    await flushOutbox();

    expect(await localDb.workouts.get(WORKOUT_ID)).toBeUndefined();
    expect((await localDb.outbox.toArray()).map((e) => e.op)).toEqual(["delete"]);
  });

  it("si la descarga falla, nada se pierde: sigue en el outbox y el siguiente flush la reintenta", async () => {
    const OTHER_ID = "55555555-5555-4555-8555-555555555555";
    const otherRewards = { new_prs: [], new_achievements: ["primera_sesion"], streak_delta: 1 };
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/sync/workouts") {
        return {
          results: [
            { id: WORKOUT_ID, status: "skipped_stale" },
            { id: OTHER_ID, status: "applied" },
          ],
          rewards: otherRewards,
        } satisfies SyncResponse;
      }
      throw new Error("network down");
    });
    const local = makeWorkout();
    await upsertLocalWorkout(local);
    await upsertLocalWorkout(makeWorkout({ id: OTHER_ID }));

    const first = await flushOutbox();

    // El aplicado se confirma y conserva sus recompensas; el obsoleto espera intacto.
    expect(first).toEqual(otherRewards);
    expect(getSyncState().phase).toBe("error");
    expect((await localDb.outbox.toArray()).map((e) => e.workout_id)).toEqual([WORKOUT_ID]);
    expect((await localDb.workouts.get(OTHER_ID))?.sync_status).toBe("synced");
    expect(await localDb.workouts.get(WORKOUT_ID)).toEqual({ ...local, sync_status: "pending" });

    apiMock.mockReset();
    routeApi(okResponse([WORKOUT_ID], "skipped_stale"), serverCopy);
    await flushOutbox();

    expect(await localDb.outbox.count()).toBe(0);
    expect(await localDb.workouts.get(WORKOUT_ID)).toEqual({ ...serverCopy, sync_status: "synced" });
  });

  it("NO acepta una copia mas vieja que la enviada (cache del SW sin red): se reintenta", async () => {
    const cached = makeWorkout({ title: "Vieja en cache", client_updated_at: "2026-07-01T10:30:00.000Z" });
    routeApi(okResponse([WORKOUT_ID], "skipped_stale"), cached);
    const local = makeWorkout();
    await upsertLocalWorkout(local);

    await flushOutbox();

    expect(getSyncState().phase).toBe("error");
    expect(await localDb.outbox.count()).toBe(1);
    expect(await localDb.workouts.get(WORKOUT_ID)).toEqual({ ...local, sync_status: "pending" });

    routeApi(okResponse([WORKOUT_ID], "skipped_stale"), serverCopy);
    await flushOutbox();
    expect(await localDb.workouts.get(WORKOUT_ID)).toEqual({ ...serverCopy, sync_status: "synced" });
  });

  it("404 (borrado en otro dispositivo): confirma y conserva la copia local", async () => {
    routeApi(okResponse([WORKOUT_ID], "skipped_stale"), async () => {
      throw new ApiError(404, "API 404");
    });
    const local = makeWorkout();
    await upsertLocalWorkout(local);

    await flushOutbox();

    expect(await localDb.outbox.count()).toBe(0);
    expect(await localDb.workouts.get(WORKOUT_ID)).toEqual({ ...local, sync_status: "synced" });
    expect(getSyncState().phase).toBe("idle");
  });
});
