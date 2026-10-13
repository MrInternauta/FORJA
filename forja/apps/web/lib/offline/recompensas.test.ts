import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingReward } from "@forja/shared";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (path: string, init?: unknown) => apiMock(path, init),
}));

import {
  aCelebracion,
  confirmarRecompensas,
  encolar,
  leerPendientes,
  porConfirmar,
  prsDelResumen,
} from "./recompensas";

const PR: PendingReward = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "pr",
  created_at: "2026-10-13T10:00:00.000Z",
  payload: { exercise_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", exercise_name: "Press banca", weight_kg: 65, reps: 8 },
};
const MEDALLA: PendingReward = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "achievement",
  created_at: "2026-10-13T10:00:01.000Z",
  payload: { id: "primer_pr" },
};
const RACHA: PendingReward = {
  id: "33333333-3333-4333-8333-333333333333",
  kind: "streak",
  created_at: "2026-10-13T10:00:02.000Z",
  payload: { delta: 1 },
};

/** localStorage en memoria (en Node no existe). */
function stubStorage() {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
}

beforeEach(() => {
  apiMock.mockReset();
  stubStorage();
});

describe("cola de celebraciones", () => {
  it("la key de cada celebración es el id del servidor", () => {
    expect(aCelebracion(PR)).toEqual({ kind: "pr", key: PR.id, exerciseName: "Press banca", weightKg: 65, reps: 8 });
    expect(aCelebracion(MEDALLA)).toEqual({ kind: "achievement", key: MEDALLA.id, id: "primer_pr" });
    expect(aCelebracion(RACHA)).toEqual({ kind: "streak", key: RACHA.id, delta: 1 });
  });

  it("encola en el orden del servidor y sin duplicar lo que ya está en cola", () => {
    const cola = encolar([], [PR, MEDALLA], new Set());
    expect(cola.map((c) => c.key)).toEqual([PR.id, MEDALLA.id]);
    // Segunda lectura (p. ej. al terminar otra pasada de sync) con lo mismo + algo nuevo
    const despues = encolar(cola, [PR, MEDALLA, RACHA], new Set());
    expect(despues.map((c) => c.key)).toEqual([PR.id, MEDALLA.id, RACHA.id]);
  });

  it("no encola lo ya mostrado aunque su confirmación no haya llegado", () => {
    expect(encolar([], [PR, MEDALLA], new Set([PR.id])).map((c) => c.key)).toEqual([MEDALLA.id]);
  });

  it("sin nada nuevo devuelve la misma cola (no re-renderiza)", () => {
    const cola = encolar([], [PR], new Set());
    expect(encolar(cola, [PR], new Set())).toBe(cola);
  });
});

describe("confirmaciones", () => {
  it("confirma contra la API y limpia el pendiente local", async () => {
    apiMock.mockResolvedValue(undefined);
    await confirmarRecompensas([PR.id]);
    expect(apiMock).toHaveBeenCalledWith("/me/rewards/ack", { method: "POST", body: { ids: [PR.id] } });
    expect(porConfirmar().size).toBe(0);
  });

  it("si la confirmación falla (offline), la recuerda y la reintenta antes de la siguiente lectura", async () => {
    apiMock.mockRejectedValueOnce(new Error("offline"));
    await confirmarRecompensas([PR.id]);
    expect(porConfirmar().has(PR.id)).toBe(true);

    // Vuelve la red. Servidor simulado con estado: el ack marca como vistas.
    let servidor = [PR, MEDALLA];
    apiMock.mockImplementation(async (path: string, init?: { body?: { ids: string[] } }) => {
      if (path === "/me/rewards") return servidor;
      servidor = servidor.filter((r) => !init?.body?.ids.includes(r.id));
    });
    const pendientes = await leerPendientes();
    expect(apiMock).toHaveBeenCalledWith("/me/rewards/ack", { method: "POST", body: { ids: [PR.id] } });
    expect(pendientes?.map((r) => r.id)).toEqual([MEDALLA.id]);
    expect(porConfirmar().size).toBe(0);
  });

  it("mientras la confirmación siga sin llegar, la oculta aunque el servidor aún la devuelva", async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/me/rewards") return [PR, MEDALLA];
      throw new Error("ack caído");
    });
    await confirmarRecompensas([PR.id]);
    expect((await leerPendientes())?.map((r) => r.id)).toEqual([MEDALLA.id]);
  });

  it("sin red para leer devuelve null (no vacía la cola)", async () => {
    apiMock.mockRejectedValue(new Error("offline"));
    expect(await leerPendientes()).toBeNull();
  });

  it("sin localStorage sigue funcionando", async () => {
    vi.stubGlobal("localStorage", undefined);
    apiMock.mockResolvedValue([PR]);
    expect((await leerPendientes())?.map((r) => r.id)).toEqual([PR.id]);
    await expect(confirmarRecompensas([PR.id])).resolves.toBeUndefined();
  });
});

describe("tarjetas de PR del resumen de /sesion", () => {
  const respuesta = [PR.payload];

  it("con las pendientes del servidor: solo PRs y confirmables", () => {
    const tarjetas = prsDelResumen([PR, MEDALLA, RACHA], respuesta);
    expect(tarjetas).toEqual([{ ...aCelebracion(PR), confirmar: true }]);
  });

  it("sin red para leerlas: las de la respuesta, sin confirmar (el shell las repetirá)", () => {
    const tarjetas = prsDelResumen(null, respuesta);
    expect(tarjetas).toHaveLength(1);
    expect(tarjetas[0]).toMatchObject({ exerciseName: "Press banca", weightKg: 65, reps: 8, confirmar: false });
  });
});
