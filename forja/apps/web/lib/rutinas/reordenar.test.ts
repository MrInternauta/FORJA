import { describe, expect, it } from "vitest";
import { moveItem, targetIndex } from "./reordenar";

describe("moveItem", () => {
  const arr = ["a", "b", "c", "d"];

  it("mueve un elemento hacia abajo y hacia arriba", () => {
    expect(moveItem(arr, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(arr, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(arr, 1, 2)).toEqual(["a", "c", "b", "d"]);
  });

  it("mueve a los extremos", () => {
    expect(moveItem(arr, 0, 3)).toEqual(["b", "c", "d", "a"]);
    expect(moveItem(arr, 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("devuelve el mismo arreglo si el índice no cambia", () => {
    expect(moveItem(arr, 2, 2)).toBe(arr);
  });

  it("devuelve el mismo arreglo con índices fuera de rango", () => {
    expect(moveItem(arr, -1, 2)).toBe(arr);
    expect(moveItem(arr, 0, -1)).toBe(arr);
    expect(moveItem(arr, 0, 4)).toBe(arr);
    expect(moveItem(arr, 4, 0)).toBe(arr);
  });

  it("no muta el arreglo de entrada", () => {
    const input = ["a", "b", "c"];
    moveItem(input, 0, 2);
    expect(input).toEqual(["a", "b", "c"]);
  });
});

describe("targetIndex", () => {
  const mids = [100, 200, 300];

  it("por encima de todos → 0, por debajo → n", () => {
    expect(targetIndex(mids, 50)).toBe(0);
    expect(targetIndex(mids, 350)).toBe(3);
  });

  it("entre puntos medios cuenta los que quedan por encima", () => {
    expect(targetIndex(mids, 150)).toBe(1);
    expect(targetIndex(mids, 250)).toBe(2);
  });

  it("exactamente sobre un punto medio NO lo cuenta (comparación estricta)", () => {
    expect(targetIndex(mids, 200)).toBe(1);
    expect(targetIndex(mids, 100)).toBe(0);
    expect(targetIndex(mids, 201)).toBe(2);
  });
});
