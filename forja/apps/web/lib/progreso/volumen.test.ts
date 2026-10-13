import { describe, expect, it } from "vitest";
import { fillWeeks, niceTicks, weekKey, weekOverWeek } from "./volumen";

describe("weekKey", () => {
  it("devuelve el lunes UTC de la semana ISO", () => {
    expect(weekKey(new Date("2026-09-20T23:00:00Z"))).toBe("2026-09-14"); // domingo
    expect(weekKey(new Date("2026-09-21T00:00:00Z"))).toBe("2026-09-21"); // lunes
    expect(weekKey(new Date("2026-01-01T12:00:00Z"))).toBe("2025-12-29"); // cruza de anio
  });
});

describe("fillWeeks", () => {
  const now = new Date("2026-09-17T12:00:00Z"); // jueves, semana del 14

  it("rellena con ceros las semanas sin sesiones y termina en la actual", () => {
    const filled = fillWeeks([{ week_start: "2026-08-31", volume_kg: 1300, workouts: 1 }], 4, now);
    expect(filled.map((p) => p.week_start)).toEqual(["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14"]);
    expect(filled.map((p) => p.volume_kg)).toEqual([0, 1300, 0, 0]);
  });

  it("descarta semanas fuera del rango pedido", () => {
    const filled = fillWeeks([{ week_start: "2026-01-05", volume_kg: 999, workouts: 1 }], 4, now);
    expect(filled.every((p) => p.volume_kg === 0)).toBe(true);
  });
});

describe("weekOverWeek", () => {
  const pt = (volume_kg: number) => ({ week_start: "x", volume_kg, workouts: 1 });

  it("calcula el % redondeado contra la semana pasada", () => {
    expect(weekOverWeek([pt(7500), pt(8420)])).toBe(12);
    expect(weekOverWeek([pt(8000), pt(2000)])).toBe(-75);
  });

  it("es null sin base de comparacion", () => {
    expect(weekOverWeek([pt(0), pt(500)])).toBeNull();
    expect(weekOverWeek([pt(500)])).toBeNull();
  });
});

describe("niceTicks", () => {
  it("redondea el tope a un paso limpio", () => {
    expect(niceTicks(8420)).toEqual([0, 2500, 5000, 7500, 10000]);
    expect(niceTicks(1300)).toEqual([0, 500, 1000, 1500]);
    expect(niceTicks(4000)).toEqual([0, 1000, 2000, 3000, 4000]);
  });

  it("sin volumen solo la base", () => {
    expect(niceTicks(0)).toEqual([0]);
  });
});
