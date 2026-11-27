import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Workout } from "@forja/shared";

// upsertLocalWorkout pide Background Sync; en Node no hay SW.
vi.mock("./background-sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./background-sync")>()),
  requestBackgroundSync: vi.fn(async () => false),
}));

import { discardLocalWorkout, localDb, observeActiveLocalWorkout, pickLocalSession, upsertLocalWorkout, type LocalWorkout } from "./db";

const ACTIVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DONE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeWorkout(id: string, ended_at: string | null): Workout {
  return {
    id,
    routine_id: null,
    title: "Pierna",
    notes: null,
    started_at: "2026-07-01T10:00:00.000Z",
    ended_at,
    client_updated_at: "2026-07-01T10:30:00.000Z",
    exercises: [],
  };
}

beforeEach(async () => {
  await localDb.workouts.clear();
  await localDb.outbox.clear();
});

describe("pickLocalSession", () => {
  it("sin sesiones locales no reanuda nada", async () => {
    expect(await pickLocalSession()).toBeNull();
  });

  it("con ?resume= abre esa sesion y marca que la URL ya apunta a ella", async () => {
    await upsertLocalWorkout(makeWorkout(ACTIVE, null));
    const picked = await pickLocalSession(ACTIVE);
    expect(picked?.workout.id).toBe(ACTIVE);
    expect(picked?.fromUrl).toBe(true);
  });

  it("sin ?resume= reanuda la sesion activa en su sitio (fromUrl=false, sin redirigir)", async () => {
    // Regresion: antes se redirigia con router.replace y offline la pantalla quedaba en blanco.
    await upsertLocalWorkout(makeWorkout(DONE, "2026-07-01T11:00:00.000Z"));
    await upsertLocalWorkout(makeWorkout(ACTIVE, null));
    const picked = await pickLocalSession();
    expect(picked?.workout.id).toBe(ACTIVE);
    expect(picked?.fromUrl).toBe(false);
  });

  it("las sesiones terminadas no se reanudan", async () => {
    await upsertLocalWorkout(makeWorkout(DONE, "2026-07-01T11:00:00.000Z"));
    expect(await pickLocalSession()).toBeNull();
  });

  it("un ?resume= que no existe en local es un error (la UI ofrece volver)", async () => {
    await expect(pickLocalSession(ACTIVE)).rejects.toThrow();
  });
});

describe("observeActiveLocalWorkout (pildora sin sondeo)", () => {
  /** Observa y devuelve las emisiones; `until` espera a que llegue una que cumpla. */
  function observe() {
    const seen: (LocalWorkout | null)[] = [];
    const stop = observeActiveLocalWorkout((w) => seen.push(w));
    const until = (pred: (w: LocalWorkout | null) => boolean) =>
      vi.waitFor(() => expect(seen.some(pred)).toBe(true), { timeout: 2000 });
    return { seen, stop, until };
  }

  it("emite al empezar, al terminar y al descartar, sin esperar un intervalo", async () => {
    const { seen, stop, until } = observe();
    await until((w) => w === null);

    await upsertLocalWorkout(makeWorkout(ACTIVE, null));
    await until((w) => w?.id === ACTIVE);

    seen.length = 0;
    await upsertLocalWorkout(makeWorkout(ACTIVE, "2026-07-01T11:00:00.000Z")); // terminada: ya no es activa
    await until((w) => w === null);

    await upsertLocalWorkout(makeWorkout(DONE, null));
    await until((w) => w?.id === DONE);
    seen.length = 0;
    await discardLocalWorkout(DONE);
    await until((w) => w === null);
    stop();
  });

  it("al dejar de observar ya no avisa", async () => {
    const { seen, stop, until } = observe();
    await until((w) => w === null);
    stop();
    seen.length = 0;
    await upsertLocalWorkout(makeWorkout(ACTIVE, null));
    await new Promise((r) => setTimeout(r, 100));
    expect(seen).toEqual([]);
  });
});
