import { computeStreak } from "./streak";

const CURRENT = new Date("2026-11-23T00:00:00Z");
/** Semanas cumplidas como offsets hacia atras: 0 = la actual, 1 = la pasada... */
function weeks(...offsets: number[]): Map<string, number> {
  return new Map(
    offsets.map((o) => [new Date(CURRENT.getTime() - o * 7 * 86_400_000).toISOString().slice(0, 10), 1]),
  );
}

describe("computeStreak", () => {
  it("cuenta semanas consecutivas hasta la pasada; la actual sin cumplir no rompe", () => {
    expect(computeStreak(weeks(3, 2, 1), CURRENT, 1)).toEqual({ streak: 3, graceWeeks: 0 });
  });

  it("la semana actual suma si ya se cumplio", () => {
    expect(computeStreak(weeks(1, 0), CURRENT, 1)).toEqual({ streak: 2, graceWeeks: 0 });
  });

  it("respeta el objetivo semanal", () => {
    expect(computeStreak(weeks(2, 1), CURRENT, 2)).toEqual({ streak: 0, graceWeeks: 0 });
  });

  it("gana 1 semana de gracia cada 4 cumplidas", () => {
    expect(computeStreak(weeks(4, 3, 2, 1), CURRENT, 1)).toEqual({ streak: 4, graceWeeks: 1 });
    expect(computeStreak(weeks(8, 7, 6, 5, 4, 3, 2, 1), CURRENT, 1)).toEqual({ streak: 8, graceWeeks: 2 });
  });

  it("la gracia puentea una semana fallida: la racha sigue y la semana puenteada no suma", () => {
    // Antes de la gracia: 6,5,4,3 cumplidas, 2 sin cumplir, 1 cumplida => racha 1.
    expect(computeStreak(weeks(6, 5, 4, 3, 1), CURRENT, 1)).toEqual({ streak: 5, graceWeeks: 0 });
  });

  it("la semana pasada sin cumplir tambien se puentea", () => {
    expect(computeStreak(weeks(5, 4, 3, 2), CURRENT, 1)).toEqual({ streak: 4, graceWeeks: 0 });
  });

  it("sin gracia, una semana fallida rompe la racha", () => {
    expect(computeStreak(weeks(5, 4, 3, 1), CURRENT, 1)).toEqual({ streak: 1, graceWeeks: 0 });
  });

  it("dos semanas fallidas con una sola gracia rompen la racha y la gracia se pierde con ella", () => {
    expect(computeStreak(weeks(6, 5, 4, 3), CURRENT, 1)).toEqual({ streak: 0, graceWeeks: 0 });
  });

  it("dos gracias puentean dos semanas fallidas", () => {
    expect(computeStreak(weeks(10, 9, 8, 7, 6, 5, 4, 3), CURRENT, 1)).toEqual({ streak: 8, graceWeeks: 0 });
  });

  it("las semanas puenteadas no cuentan para ganar la siguiente gracia", () => {
    // 5 cumplidas (1 gracia), 1 puenteada, 3 cumplidas = 8 cumplidas => 2 ganadas - 1 usada.
    expect(computeStreak(weeks(9, 8, 7, 6, 5, 3, 2, 1), CURRENT, 1)).toEqual({ streak: 8, graceWeeks: 1 });
  });
});
