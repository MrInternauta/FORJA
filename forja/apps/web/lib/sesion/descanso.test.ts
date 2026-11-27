import { describe, expect, it } from "vitest";
import { ajustar, restante } from "./descanso";

describe("restante", () => {
  it("devuelve segundos enteros en el borde exacto", () => {
    expect(restante(10_000, 0)).toBe(10);
    expect(restante(10_000, 9_000)).toBe(1);
  });

  it("el segundo parcial redondea hacia arriba", () => {
    expect(restante(10_000, 9_500)).toBe(1);
    expect(restante(10_000, 100)).toBe(10);
  });

  it("pasada la hora devuelve 0", () => {
    expect(restante(10_000, 10_000)).toBe(0);
    expect(restante(10_000, 20_000)).toBe(0);
  });
});

describe("ajustar", () => {
  it("suma y resta segundos sobre la fecha limite", () => {
    expect(ajustar(60_000, 1_000, 15)).toBe(75_000);
    expect(ajustar(60_000, 1_000, -15)).toBe(45_000);
  });

  it("nunca queda antes de ahora", () => {
    expect(ajustar(5_000, 30_000, -15)).toBe(30_000);
    expect(ajustar(5_000, 30_000, 15)).toBe(30_000);
  });
});
