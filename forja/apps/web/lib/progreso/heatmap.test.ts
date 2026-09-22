import { describe, expect, it } from "vitest";
import { heatLegend, heatStep, rangeStart } from "./heatmap";

describe("heatStep", () => {
  it("0 sin series; el maximo siempre es el paso mas alto", () => {
    expect(heatStep(0, 16)).toBe(0);
    expect(heatStep(16, 16)).toBe(4);
    expect(heatStep(1, 1)).toBe(4);
  });

  it("cuartos relativos al maximo", () => {
    expect([1, 4, 5, 8, 9, 12, 13].map((s) => heatStep(s, 16))).toEqual([1, 1, 2, 2, 3, 3, 4]);
  });
});

describe("heatLegend", () => {
  it("rangos contiguos que cubren 1..max", () => {
    expect(heatLegend(16)).toEqual([
      { step: 1, from: 1, to: 4 },
      { step: 2, from: 5, to: 8 },
      { step: 3, from: 9, to: 12 },
      { step: 4, from: 13, to: 16 },
    ]);
  });

  it("con max chico omite pasos sin enteros y concuerda con heatStep", () => {
    const legend = heatLegend(2);
    expect(legend).toEqual([
      { step: 2, from: 1, to: 1 },
      { step: 4, from: 2, to: 2 },
    ]);
    for (const { step, from, to } of legend) for (let s = from; s <= to; s++) expect(heatStep(s, 2)).toBe(step);
  });

  it("vacia sin datos", () => {
    expect(heatLegend(0)).toEqual([]);
  });
});

describe("rangeStart", () => {
  it("lunes UTC de hace weeks-1 semanas", () => {
    const now = new Date("2026-09-17T12:00:00Z"); // semana del 14
    expect(rangeStart(1, now)).toBe("2026-09-14T00:00:00.000Z");
    expect(rangeStart(4, now)).toBe("2026-08-24T00:00:00.000Z");
  });
});
