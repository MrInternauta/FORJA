import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Workout } from "@forja/shared";

vi.mock("../offline/background-sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../offline/background-sync")>()),
  requestBackgroundSync: vi.fn(async () => false),
}));

const apiMock = vi.fn();
vi.mock("../api", () => ({ api: (path: string) => apiMock(path) }));

import { localDb, upsertLocalWorkout } from "../offline/db";
import { volumenPendienteLocal } from "./volumen-local";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function sesion(id: string, overrides: Partial<Workout> = {}): Workout {
  return {
    id,
    routine_id: null,
    title: "Empuje",
    notes: null,
    started_at: "2026-09-16T10:00:00.000Z",
    ended_at: "2026-09-16T11:00:00.000Z",
    client_updated_at: "2026-09-16T11:00:00.000Z",
    exercises: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        exercise_id: "44444444-4444-4444-8444-444444444444",
        position: 1,
        sets: [{ id: "55555555-5555-4555-8555-555555555555", position: 1, reps: 10, weight_kg: 50, rpe: null, is_completed: true }],
      },
    ],
    ...overrides,
  };
}

const pagina = (items: { id: string; ended_at: string | null }[], next_cursor: string | null = null) => ({ items, next_cursor });

beforeEach(async () => {
  apiMock.mockReset();
  await localDb.workouts.clear();
  await localDb.outbox.clear();
});

describe("volumenPendienteLocal", () => {
  it("sin sesiones pendientes no pide nada a la red", async () => {
    await localDb.workouts.put({ ...sesion(A), sync_status: "synced" });
    expect(await volumenPendienteLocal()).toEqual([]);
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("cuenta las terminadas sin sincronizar que la red no tiene terminadas", async () => {
    await upsertLocalWorkout(sesion(A));
    await upsertLocalWorkout(sesion(B, { ended_at: null })); // en curso: no cuenta
    // El servidor la tiene, pero aun sin terminar (sesion online que se termino offline).
    apiMock.mockResolvedValue(pagina([{ id: A, ended_at: null }]));

    expect(await volumenPendienteLocal()).toEqual([{ started_at: "2026-09-16T10:00:00.000Z", volume_kg: 500 }]);
    expect(apiMock).toHaveBeenCalledWith(
      `/workouts?from=${encodeURIComponent("2026-09-16T10:00:00.000Z")}&to=${encodeURIComponent("2026-09-16T10:00:00.000Z")}`,
    );
  });

  it("gana la copia de red: si el servidor ya la tiene terminada no se cuenta dos veces", async () => {
    // Editada despues de sincronizar (o se perdio la respuesta del sync): sigue pendiente en local.
    await upsertLocalWorkout(sesion(A));
    await upsertLocalWorkout(sesion(B, { started_at: "2026-09-10T10:00:00.000Z" }));
    apiMock
      .mockResolvedValueOnce(pagina([{ id: "66666666-6666-4666-8666-666666666666", ended_at: "x" }], "cursor-1"))
      .mockResolvedValueOnce(pagina([{ id: A, ended_at: "2026-09-16T11:00:00.000Z" }]));

    expect(await volumenPendienteLocal()).toEqual([{ started_at: "2026-09-10T10:00:00.000Z", volume_kg: 500 }]);
    expect(apiMock).toHaveBeenCalledTimes(2);
    expect(apiMock.mock.calls[1][0]).toContain("&cursor=cursor-1");
  });

  it("sin red cuentan todas las terminadas locales", async () => {
    await upsertLocalWorkout(sesion(A));
    apiMock.mockRejectedValue(new Error("offline"));
    expect(await volumenPendienteLocal()).toEqual([{ started_at: "2026-09-16T10:00:00.000Z", volume_kg: 500 }]);
  });
});
