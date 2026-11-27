import { describe, expect, it } from "vitest";
import { fillWeeks, niceTicks, sumarVolumenLocal, volumenDeSesion, weekKey, weekOverWeek } from "./volumen";

describe("weekKey", () => {
  it("devuelve el lunes de la semana ISO", () => {
    expect(weekKey(new Date("2026-09-20T23:00:00Z"), "UTC")).toBe("2026-09-14"); // domingo
    expect(weekKey(new Date("2026-09-21T00:00:00Z"), "UTC")).toBe("2026-09-21"); // lunes
    expect(weekKey(new Date("2026-01-01T12:00:00Z"), "UTC")).toBe("2025-12-29"); // cruza de anio
  });

  it("corta en el lunes 00:00 local, no en el de UTC", () => {
    // Domingo 23:30 en CDMX (UTC-6) ya es lunes 05:30 en UTC.
    expect(weekKey(new Date("2026-09-21T05:30:00Z"), "America/Mexico_City")).toBe("2026-09-14");
    expect(weekKey(new Date("2026-09-21T05:30:00Z"), "UTC")).toBe("2026-09-21");
    expect(weekKey(new Date("2026-09-21T06:00:00Z"), "America/Mexico_City")).toBe("2026-09-21");
  });
});

describe("fillWeeks", () => {
  const now = new Date("2026-09-17T12:00:00Z"); // jueves, semana del 14

  it("rellena con ceros las semanas sin sesiones y termina en la actual", () => {
    const filled = fillWeeks([{ week_start: "2026-08-31", volume_kg: 1300, workouts: 1 }], 4, "UTC", now);
    expect(filled.map((p) => p.week_start)).toEqual(["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14"]);
    expect(filled.map((p) => p.volume_kg)).toEqual([0, 1300, 0, 0]);
  });

  it("descarta semanas fuera del rango pedido", () => {
    const filled = fillWeeks([{ week_start: "2026-01-05", volume_kg: 999, workouts: 1 }], 4, "UTC", now);
    expect(filled.every((p) => p.volume_kg === 0)).toBe(true);
  });

  it("la semana actual es la de la zona del usuario", () => {
    const lunesUtc = new Date("2026-09-21T03:00:00Z"); // aun domingo 21:00 en CDMX
    expect(fillWeeks([], 1, "UTC", lunesUtc)[0].week_start).toBe("2026-09-21");
    expect(fillWeeks([], 1, "America/Mexico_City", lunesUtc)[0].week_start).toBe("2026-09-14");
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

describe("sumarVolumenLocal", () => {
  const now = new Date("2026-09-17T12:00:00Z");

  it("suma a la semana existente y crea la que falta", () => {
    const points = [{ week_start: "2026-09-14", volume_kg: 1000, workouts: 1 }];
    const merged = sumarVolumenLocal(
      points,
      [
        { started_at: "2026-09-16T10:00:00Z", volume_kg: 500 },
        { started_at: "2026-09-08T10:00:00Z", volume_kg: 300 },
      ],
      "UTC",
    );
    expect(merged).toEqual([
      { week_start: "2026-09-07", volume_kg: 300, workouts: 1 },
      { week_start: "2026-09-14", volume_kg: 1500, workouts: 2 },
    ]);
    expect(points[0].volume_kg).toBe(1000); // no muta la respuesta de la API
  });

  it("usa la semana local del usuario: domingo 23:30 CDMX no cae en el lunes UTC", () => {
    const merged = sumarVolumenLocal([], [{ started_at: "2026-09-14T05:30:00Z", volume_kg: 700 }], "America/Mexico_City");
    expect(fillWeeks(merged, 2, "America/Mexico_City", now).map((p) => p.volume_kg)).toEqual([700, 0]);
    const utc = sumarVolumenLocal([], [{ started_at: "2026-09-14T05:30:00Z", volume_kg: 700 }], "UTC");
    expect(fillWeeks(utc, 2, "UTC", now).map((p) => p.volume_kg)).toEqual([0, 700]);
  });
});

describe("volumenDeSesion", () => {
  it("solo cuenta series completadas", () => {
    const set = (weight_kg: number, reps: number, is_completed: boolean) => ({ id: "s", position: 1, weight_kg, reps, rpe: null, is_completed });
    expect(
      volumenDeSesion({
        id: "w", title: "t", started_at: "2026-09-16T10:00:00Z", client_updated_at: "2026-09-16T10:00:00Z",
        exercises: [{ id: "e", exercise_id: "x", position: 1, sets: [set(60, 8, true), set(100, 1, false)] }],
      }),
    ).toBe(480);
  });
});
