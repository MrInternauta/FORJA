import { describe, expect, it } from "vitest";
import { formatPeso, haceCuanto } from "./prs";

describe("haceCuanto", () => {
  const now = new Date(2026, 8, 20, 10, 0); // 20 sep 2026, 10:00 local

  it("usa dias de calendario", () => {
    expect(haceCuanto(new Date(2026, 8, 20, 8, 0).toISOString(), now)).toBe("hoy");
    expect(haceCuanto(new Date(2026, 8, 19, 23, 59).toISOString(), now)).toBe("ayer");
    expect(haceCuanto(new Date(2026, 8, 17, 12, 0).toISOString(), now)).toBe("hace 3 días");
  });

  it("escala a semanas, meses y anios", () => {
    expect(haceCuanto(new Date(2026, 8, 6).toISOString(), now)).toBe("hace 2 semanas");
    expect(haceCuanto(new Date(2026, 4, 20).toISOString(), now)).toBe("hace 4 meses");
    expect(haceCuanto(new Date(2025, 5, 1).toISOString(), now)).toBe("hace 1 año");
  });

  it("un reloj adelantado no produce futuro", () => {
    expect(haceCuanto(new Date(2026, 8, 21).toISOString(), now)).toBe("hoy");
  });
});

describe("formatPeso", () => {
  it("sin decimales de relleno", () => {
    expect(formatPeso(140)).toBe("140");
    expect(formatPeso(82.5)).toBe("82.5");
  });
});
