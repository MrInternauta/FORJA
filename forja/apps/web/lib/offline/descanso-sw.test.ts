import { afterEach, describe, expect, it, vi } from "vitest";
import { crearProgramadorDescanso, type DescansoDeps } from "./descanso-sw";

function setup({ visible = false } = {}) {
  const calls = { mostrar: 0 };
  const deps: DescansoDeps = {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as number),
    hayClienteVisible: async () => visible,
    mostrar: async () => {
      calls.mostrar++;
    },
  };
  return { programador: crearProgramadorDescanso(deps), calls };
}

describe("crearProgramadorDescanso", () => {
  afterEach(() => vi.useRealTimers());

  it("avisa al llegar la hora si no hay cliente visible", async () => {
    vi.useFakeTimers();
    const { programador, calls } = setup();
    const p = programador.programar(Date.now() + 3000);
    await vi.advanceTimersByTimeAsync(3000);
    await p;
    expect(calls.mostrar).toBe(1);
  });

  it("no avisa si hay un cliente visible", async () => {
    vi.useFakeTimers();
    const { programador, calls } = setup({ visible: true });
    const p = programador.programar(Date.now() + 3000);
    await vi.advanceTimersByTimeAsync(3000);
    await p;
    expect(calls.mostrar).toBe(0);
  });

  it("hora ya pasada avisa de inmediato", async () => {
    const { programador, calls } = setup();
    await programador.programar(Date.now() - 1000);
    expect(calls.mostrar).toBe(1);
  });

  it("reprogramar reemplaza: solo avisa el ultimo y la primera promesa resuelve", async () => {
    vi.useFakeTimers();
    const { programador, calls } = setup();
    const primera = programador.programar(Date.now() + 3000);
    const segunda = programador.programar(Date.now() + 5000);
    await primera; // resuelve sin avisar
    await vi.advanceTimersByTimeAsync(5000);
    await segunda;
    expect(calls.mostrar).toBe(1);
  });

  it("cancelar resuelve la promesa sin avisar", async () => {
    vi.useFakeTimers();
    const { programador, calls } = setup();
    const p = programador.programar(Date.now() + 3000);
    programador.cancelar();
    await p;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls.mostrar).toBe(0);
  });
});
