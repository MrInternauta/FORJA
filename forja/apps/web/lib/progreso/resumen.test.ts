import { describe, expect, it } from "vitest";
import { compararVolumen, resumenCopy, shiftWeek } from "./resumen";

describe("shiftWeek", () => {
  it("mueve semanas completas, cruzando mes y anio", () => {
    expect(shiftWeek("2026-09-14", -1)).toBe("2026-09-07");
    expect(shiftWeek("2026-09-28", 1)).toBe("2026-10-05");
    expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
  });
});

describe("resumenCopy", () => {
  it("cumplida, parcial y descanso sin lenguaje punitivo", () => {
    expect(resumenCopy({ sessions: 4, weekly_goal: 3, goal_met: true })).toBe("Semana cumplida: 4 sesiones (objetivo: 3).");
    expect(resumenCopy({ sessions: 2, weekly_goal: 3, goal_met: false })).toBe("2 de 3 sesiones. Cada una suma.");
    expect(resumenCopy({ sessions: 0, weekly_goal: 3, goal_met: false })).toMatch(/descanso/);
  });

  it("singular con objetivo de 1", () => {
    expect(resumenCopy({ sessions: 0, weekly_goal: 1, goal_met: false })).not.toMatch(/sesiones\./);
  });
});

describe("compararVolumen", () => {
  it("sube con %, baja solo con la referencia, sin base nada", () => {
    expect(compararVolumen(1120, 1000)).toEqual({ kind: "sube", pct: 12 });
    expect(compararVolumen(1000, 1000)).toEqual({ kind: "sube", pct: 0 });
    expect(compararVolumen(500, 1000)).toEqual({ kind: "baja", anterior: 1000 });
    expect(compararVolumen(500, 0)).toBeNull();
  });
});
