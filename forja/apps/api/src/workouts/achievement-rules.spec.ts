import { ACHIEVEMENT_RULES, eligibleAchievements } from "@forja/shared";

const zero = { workouts: 0, volume_kg: 0, streak_weeks: 0, prs: 0 };

describe("eligibleAchievements (reglas compartidas)", () => {
  it("nada sin actividad", () => {
    expect(eligibleAchievements(zero)).toEqual([]);
  });

  it("umbrales inclusivos por metrica", () => {
    expect(eligibleAchievements({ ...zero, workouts: 10 })).toEqual(["primera_sesion", "sesiones_10"]);
    expect(eligibleAchievements({ ...zero, volume_kg: 9_999.99 })).toEqual([]);
    expect(eligibleAchievements({ ...zero, volume_kg: 100_000 })).toEqual(["volumen_10k", "volumen_100k"]);
    expect(eligibleAchievements({ ...zero, streak_weeks: 12 })).toEqual(["racha_4", "racha_12"]);
    expect(eligibleAchievements({ ...zero, prs: 1 })).toEqual(["primer_pr"]);
  });

  it("prs_25 no se otorga mientras no haya log de eventos de PR", () => {
    expect(ACHIEVEMENT_RULES.prs_25.measurable).toBe(false);
    expect(eligibleAchievements({ workouts: 1e6, volume_kg: 1e9, streak_weeks: 1e3, prs: 1e3 })).not.toContain("prs_25");
  });

  it("cubre exactamente los 15 logros sembrados", () => {
    expect(Object.keys(ACHIEVEMENT_RULES)).toHaveLength(15);
  });
});
