// E2E de API — cierre de Fase 1. Postgres real (Supabase local) + API compilada + JWT reales de Supabase Auth.
// Requisitos: `supabase start`, API en :3001 (`pnpm --filter @forja/api build && node apps/api/dist/main.js`).
// Uso: pnpm --filter @forja/e2e e2e:api
import { randomUUID } from "node:crypto";
import { call, check, finish, near, newUser, section, signIn } from "./lib.mjs";

const iso = (d) => new Date(d).toISOString();
const now = Date.now();
const H = 3600_000;
let clock = now - 10 * H; // reloj logico del cliente, siempre creciente
const tick = () => iso((clock += 1000));

function set(position, weight_kg, reps, is_completed = true, rpe = null) {
  return { id: randomUUID(), position, weight_kg, reps, rpe, is_completed };
}
function workout({ id = randomUUID(), routine_id = null, started_at, ended_at = null, exercises, title = "E2E" }) {
  return {
    id, routine_id, title, started_at: iso(started_at), ended_at: ended_at ? iso(ended_at) : null,
    client_updated_at: tick(),
    exercises: exercises.map((e, i) => ({ id: e.weId ?? randomUUID(), exercise_id: e.exercise_id, position: i + 1, sets: e.sets })),
  };
}
const upsert = (w) => ({ op: "upsert", workout: w });

/* ================================================================== */

const A = await newUser("a");
const B = await newUser("b");

section("Salud y autenticación");
check("GET /health 200", (await call(null, "GET", "/health")).status === 200);
check("sin token → 401", (await call(null, "GET", "/me")).status === 401);
check("token basura → 401", (await call("x.y.z", "GET", "/me")).status === 401);
check("GET /me antes del onboarding → 404 legible", await call(A.token, "GET", "/me").then((r) => r.status === 404 && /onboarding/i.test(r.body?.message)));

section("Onboarding y perfil");
const userA = `e2e_a_${String(now).slice(-8)}`;
let r = await call(A.token, "POST", "/auth/onboarding", { username: userA });
check("onboarding A → 201", r.status === 201, r);
check("onboarding repetido → 409", (await call(A.token, "POST", "/auth/onboarding", { username: userA + "x" })).status === 409);
check("username ocupado → 409 legible", await call(B.token, "POST", "/auth/onboarding", { username: userA }).then((r) => r.status === 409 && /en uso/.test(r.body?.message)));
check("username inválido → 400", (await call(B.token, "POST", "/auth/onboarding", { username: "Con Espacios" })).status === 400);
check("onboarding B → 201", (await call(B.token, "POST", "/auth/onboarding", { username: `e2e_b_${String(now).slice(-8)}` })).status === 201);
// El rol viaja en el JWT (hook custom_access_token): un token emitido ANTES del perfil no lo trae.
A.token = await signIn(A.email, A.password);
B.token = await signIn(B.email, B.password);
const claim = JSON.parse(Buffer.from(A.token.split(".")[1], "base64url").toString());
check("JWT trae claim user_role=FREE (hook)", claim.user_role === "FREE", claim.user_role);
r = await call(A.token, "GET", "/me");
check("GET /me → perfil + stats", r.status === 200 && r.body.profile.username === userA && r.body.stats.weekly_goal === 3, r.body);
check("privado por defecto", r.body?.profile?.is_public === false);
check("PATCH weekly_goal=2", (await call(A.token, "PATCH", "/me", { weekly_goal: 2 })).status === 200);
check("PATCH weekly_goal=8 → 400", (await call(A.token, "PATCH", "/me", { weekly_goal: 8 })).status === 400);
check("weekly_goal persistido", (await call(A.token, "GET", "/me")).body.stats.weekly_goal === 2);

section("Catálogo de ejercicios");
r = await call(A.token, "GET", "/exercises?muscle_group=chest");
check("filtro por grupo: solo pecho", r.status === 200 && r.body.items.length > 0 && r.body.items.every((e) => e.muscle_group === "chest"), r.body);
const all = (await call(A.token, "GET", "/exercises")).body.items;
const byName = (n) => all.find((e) => e.name === n);
const BENCH = byName("Press banca"), SQUAT = byName("Sentadilla trasera"), ROW = byName("Remo con barra");
check("catálogo trae los ejercicios sembrados", BENCH && SQUAT && ROW);
r = await call(A.token, "GET", "/exercises?q=sentadilla");
check("búsqueda por texto", r.status === 200 && r.body.items.some((e) => e.id === SQUAT.id));
r = await call(A.token, "GET", `/exercises/${ROW.id}`);
check("detalle con secondary_muscles como array", r.status === 200 && Array.isArray(r.body.secondary_muscles), r.body?.secondary_muscles);
check("POST /exercises como FREE → 403", (await call(A.token, "POST", "/exercises", { name: "X", muscle_group: "chest", equipment: "barbell" })).status === 403);
check("GET /exercises/:id inexistente → 404", (await call(A.token, "GET", `/exercises/${randomUUID()}`)).status === 404);

section("Rutinas y límite de plan");
const routineBody = {
  name: "E2E Pierna y pecho",
  exercises: [
    { exercise_id: BENCH.id, position: 1, sets: [{ position: 1, target_reps: 8, target_weight_kg: 60 }, { position: 2, target_reps: 8, target_weight_kg: 62.5 }] },
    { exercise_id: SQUAT.id, position: 2, sets: [{ position: 1, target_reps: 5, target_weight_kg: 80 }] },
  ],
};
r = await call(A.token, "POST", "/routines", routineBody);
check("crear rutina → 201", r.status === 201, r);
const ROUTINE = r.body.id;
r = await call(A.token, "GET", `/routines/${ROUTINE}`);
check("detalle anidado (2 ejercicios, 2+1 series)", r.status === 200 && r.body.exercises.length === 2 && r.body.exercises[0].sets.length === 2 && r.body.exercises[1].sets.length === 1, r.body);
r = await call(A.token, "PUT", `/routines/${ROUTINE}`, { ...routineBody, exercises: [{ ...routineBody.exercises[0], sets: [{ position: 1, target_reps: 5, target_weight_kg: 90 }] }, routineBody.exercises[1]] });
check("PUT reemplazo → 200", r.status === 200, r);
r = await call(A.token, "GET", `/routines/${ROUTINE}`);
check("PUT reemplazó las series (1×90 kg)", r.body.exercises[0].sets.length === 1 && r.body.exercises[0].sets[0].target_weight_kg === 90, r.body.exercises?.[0]);
check("exercise_id inexistente → 400 legible", await call(A.token, "POST", "/routines", { name: "Mala", exercises: [{ exercise_id: randomUUID(), position: 1, sets: [{ position: 1 }] }] }).then((r) => r.status === 400 && /catálogo|catalogo/i.test(r.body?.message)));
const extra = [];
for (let i = 0; i < 4; i++) extra.push((await call(A.token, "POST", "/routines", { ...routineBody, name: `Extra ${i}` })).body.id);
check("5 rutinas FREE", (await call(A.token, "GET", "/routines")).body.items.length === 5);
r = await call(A.token, "POST", "/routines", { ...routineBody, name: "Sexta" });
check("6ª rutina FREE → 422 sin culpa", r.status === 422 && /pasa a PRO/.test(r.body?.message), r.body);
check("DELETE rutina → 204", (await call(A.token, "DELETE", `/routines/${extra.pop()}`)).status === 204);
check("recuento tras borrar = 4", (await call(A.token, "GET", "/routines")).body.items.length === 4);
check("B no ve la rutina de A → 404", (await call(B.token, "GET", `/routines/${ROUTINE}`)).status === 404);
check("DELETE de B sobre la rutina de A no borra nada", [204, 404].includes((await call(B.token, "DELETE", `/routines/${ROUTINE}`)).status) && (await call(A.token, "GET", `/routines/${ROUTINE}`)).status === 200);

section("Logger: sesión desde rutina → series → finalizar → sync → recompensas");
const S1 = randomUUID(), WE_B = randomUUID(), WE_S = randomUUID();
const s1Start = now - 2 * H;
const b1 = set(1, 60, 8), b2 = set(2, 62.5, 8), bFail = set(3, 100, 1, false), q1 = set(1, 80, 5);
// Sync tras la 1ª serie (Background Sync dispara tras cada serie)
r = await call(A.token, "POST", "/sync/workouts", { operations: [upsert(workout({ id: S1, routine_id: ROUTINE, started_at: s1Start, exercises: [{ weId: WE_B, exercise_id: BENCH.id, sets: [b1] }] }))] });
check("sync a mitad de sesión → applied", r.status === 201 || r.status === 200 ? r.body.results[0].status === "applied" : false, r);
check("a mitad de sesión: 0 PRs, 0 medallas", r.body.rewards.new_prs.length === 0 && r.body.rewards.new_achievements.length === 0, r.body.rewards);
r = await call(A.token, "GET", `/workouts/last-set/${BENCH.id}`);
check("autocompletar: last-set = 60×8", r.status === 200 && r.body.weight_kg === 60 && r.body.reps === 8, r.body);
// Más series, incluida una fallida (no completada)
r = await call(A.token, "POST", "/sync/workouts", { operations: [upsert(workout({ id: S1, routine_id: ROUTINE, started_at: s1Start, exercises: [{ weId: WE_B, exercise_id: BENCH.id, sets: [b1, b2, bFail] }, { weId: WE_S, exercise_id: SQUAT.id, sets: [q1] }] }))] });
check("2º sync en curso → applied, sin PRs", r.body.results[0].status === "applied" && r.body.rewards.new_prs.length === 0, r.body);
check("analytics excluye la sesión en curso", (await call(A.token, "GET", "/analytics/prs")).body.length === 0);
// Finalizar
const s1Final = workout({ id: S1, routine_id: ROUTINE, started_at: s1Start, ended_at: s1Start + 50 * 60_000, exercises: [{ weId: WE_B, exercise_id: BENCH.id, sets: [b1, b2, bFail] }, { weId: WE_S, exercise_id: SQUAT.id, sets: [q1] }] });
r = await call(A.token, "POST", "/sync/workouts", { operations: [upsert(s1Final)] });
const prs1 = Object.fromEntries(r.body.rewards.new_prs.map((p) => [p.exercise_id, p]));
check("finalizar → applied", r.body.results[0].status === "applied", r.body);
check("PR press banca 62.5×8 (la serie fallida de 100 kg no cuenta)", prs1[BENCH.id]?.weight_kg === 62.5 && prs1[BENCH.id]?.reps === 8, r.body.rewards.new_prs);
check("PR sentadilla 80×5 con nombre", prs1[SQUAT.id]?.weight_kg === 80 && prs1[SQUAT.id]?.exercise_name === "Sentadilla trasera");
check("medallas primera_sesion + primer_pr", ["primera_sesion", "primer_pr"].every((a) => r.body.rewards.new_achievements.includes(a)), r.body.rewards.new_achievements);
check("racha sin cambio (1 de 2 sesiones)", r.body.rewards.streak_delta === 0, r.body.rewards.streak_delta);
// Reenvío idéntico (p. ej. el outbox reintenta tras perder la respuesta)
r = await call(A.token, "POST", "/sync/workouts", { operations: [upsert(s1Final)] });
check("reenvío idéntico → skipped_stale", r.body.results[0].status === "skipped_stale", r.body);
check("reenvío: cero recompensas duplicadas", r.body.rewards.new_prs.length === 0 && r.body.rewards.new_achievements.length === 0, r.body.rewards);
// Versión vieja llega tarde (LWW)
const stale = { ...s1Final, client_updated_at: iso(now - 20 * H), exercises: [s1Final.exercises[0]] };
r = await call(A.token, "POST", "/sync/workouts", { operations: [upsert(stale)] });
check("versión más vieja → skipped_stale", r.body.results[0].status === "skipped_stale");
r = await call(A.token, "GET", "/workouts");
const s1Row = r.body.items.find((w) => w.id === S1);
check("LWW: el servidor conserva la versión nueva (3 series, 1380 kg)", s1Row?.sets_completed === 3 && near(s1Row.volume_kg, 1380), s1Row);
check("duración calculada (50 min)", s1Row?.duration_seconds === 3000, s1Row?.duration_seconds);

section("Segunda sesión: desempate por reps, racha y lote con un ítem roto");
const s2Start = now - 1 * H;
const S2 = workout({ started_at: s2Start, ended_at: s2Start + 40 * 60_000, exercises: [{ exercise_id: BENCH.id, sets: [set(1, 62.5, 10)] }, { exercise_id: SQUAT.id, sets: [set(1, 75, 5)] }] });
const broken = workout({ started_at: s2Start, ended_at: s2Start + 1000, exercises: [{ exercise_id: randomUUID(), sets: [set(1, 10, 10)] }] });
r = await call(A.token, "POST", "/sync/workouts", { operations: [upsert(broken), upsert(S2)] });
check("lote: el ítem roto → error, el válido → applied", r.body.results[0].status === "error" && r.body.results[1].status === "applied", r.body.results);
check("el ítem roto no deja rastro", !(await call(A.token, "GET", "/workouts")).body.items.some((w) => w.id === broken.id));
const prs2 = r.body.rewards.new_prs;
check("PR por desempate: banca 62.5×10", prs2.length === 1 && prs2[0].exercise_id === BENCH.id && prs2[0].reps === 10, prs2);
check("sentadilla 75×5 no es PR", !prs2.some((p) => p.exercise_id === SQUAT.id));
check("racha +1 (objetivo 2 cumplido esta semana)", r.body.rewards.streak_delta === 1, r.body.rewards);
r = await call(A.token, "GET", "/me");
check("stats: 2 sesiones, 2380 kg, racha 1", r.body.stats.total_workouts === 2 && near(r.body.stats.total_volume_kg, 2380) && r.body.stats.current_streak === 1, r.body.stats);

section("Sesión abandonada (sin terminar) y borrado");
const S3 = workout({ started_at: now - 30 * 60_000, exercises: [{ exercise_id: ROW.id, sets: [set(1, 50, 10)] }] });
await call(A.token, "POST", "/sync/workouts", { operations: [upsert(S3)] });
r = await call(A.token, "GET", "/me");
check("stats: la sesión en curso no suma volumen (como analytics)", near(r.body.stats.total_volume_kg, 2380), `total_volume_kg=${r.body.stats.total_volume_kg} (esperado 2380; la sesión en curso añade 500)`);
r = await call(A.token, "POST", "/sync/workouts", { operations: [{ op: "delete", workout_id: S3.id, client_updated_at: tick() }] });
check("borrar → applied", r.body.results[0].status === "applied");
r = await call(A.token, "POST", "/sync/workouts", { operations: [{ op: "delete", workout_id: S3.id, client_updated_at: tick() }] });
check("borrar de nuevo → applied (idempotente)", r.body.results[0].status === "applied");
check("borrada: ya no aparece", !(await call(A.token, "GET", "/workouts")).body.items.some((w) => w.id === S3.id));
// Borrar una sesión que tenía el PR vigente
const S4 = workout({ started_at: now - 20 * 60_000, ended_at: now - 10 * 60_000, exercises: [{ exercise_id: BENCH.id, sets: [set(1, 65, 3)] }] });
r = await call(A.token, "POST", "/sync/workouts", { operations: [upsert(S4)] });
check("sesión 4: PR banca 65×3", r.body.rewards.new_prs.some((p) => p.exercise_id === BENCH.id && p.weight_kg === 65));
r = await call(A.token, "POST", "/sync/workouts", { operations: [{ op: "delete", workout_id: S4.id, client_updated_at: tick() }] });
check("bajar un PR no se celebra", r.body.rewards.new_prs.length === 0, r.body.rewards);
r = await call(A.token, "GET", "/analytics/prs");
const benchPr = r.body.find((p) => p.exercise_id === BENCH.id);
check("tras borrar la sesión del PR, el PR vuelve a 62.5×10", benchPr?.weight_kg === 62.5 && benchPr?.reps === 10, benchPr);
check("…con la sesión y la fecha de la sesión 2", benchPr?.workout_id === S2.id && new Date(benchPr.achieved_at).getTime() === new Date(S2.ended_at).getTime(), benchPr);

// Corregir un typo en una sesión terminada (500 → 50 kg) baja el PR; quitar el ejercicio lo elimina
const S5 = workout({ started_at: now - 9 * 60_000, ended_at: now - 5 * 60_000, exercises: [{ exercise_id: ROW.id, sets: [set(1, 500, 5)] }] });
r = await call(A.token, "POST", "/sync/workouts", { operations: [upsert(S5)] });
check("typo 500×5 en remo → PR (aún no se sabe que es typo)", r.body.rewards.new_prs.some((p) => p.exercise_id === ROW.id && p.weight_kg === 500));
const s5Fixed = { ...S5, client_updated_at: tick(), exercises: [{ ...S5.exercises[0], sets: [set(1, 50, 5)] }] };
r = await call(A.token, "POST", "/sync/workouts", { operations: [upsert(s5Fixed)] });
check("corregido a 50×5 → applied, sin celebración", r.body.results[0].status === "applied" && r.body.rewards.new_prs.length === 0, r.body);
check("PR de remo corregido a 50×5", (await call(A.token, "GET", "/analytics/prs")).body.find((p) => p.exercise_id === ROW.id)?.weight_kg === 50);
r = await call(A.token, "POST", "/sync/workouts", { operations: [upsert({ ...s5Fixed, client_updated_at: tick(), exercises: [{ exercise_id: BENCH.id, id: randomUUID(), position: 1, sets: [set(1, 20, 5)] }] })] });
check("quitar el remo de la sesión → applied", r.body.results[0].status === "applied");
check("sin series de remo, su PR desaparece", !(await call(A.token, "GET", "/analytics/prs")).body.some((p) => p.exercise_id === ROW.id));
await call(A.token, "POST", "/sync/workouts", { operations: [{ op: "delete", workout_id: S5.id, client_updated_at: tick() }] });
r = await call(A.token, "GET", "/me");
check("stats tras borrar: 2 sesiones, 2380 kg", r.body.stats.total_workouts === 2 && near(r.body.stats.total_volume_kg, 2380), r.body.stats);
check("B no puede borrar sesiones de A", await call(B.token, "POST", "/sync/workouts", { operations: [{ op: "delete", workout_id: S1, client_updated_at: tick() }] }).then(async () => (await call(A.token, "GET", "/workouts")).body.items.some((w) => w.id === S1)));
r = await call(B.token, "POST", "/sync/workouts", { operations: [upsert({ ...s1Final, client_updated_at: tick() })] });
check("B no puede sobrescribir el workout de A → error", r.body.results[0].status === "error", r.body.results);

section("Analytics");
r = await call(A.token, "GET", "/analytics/volume?weeks=4");
const thisWeek = r.body.at(-1);
check("volume: semana actual 2380 kg, 2 sesiones", near(thisWeek?.volume_kg, 2380) && thisWeek?.workouts === 2, r.body);
r = await call(A.token, "GET", "/analytics/distribution?by=muscle_group");
const dist = Object.fromEntries(r.body.map((d) => [d.key, d]));
check("distribution pecho: 3 series, 1605 kg", dist.chest?.sets === 3 && near(dist.chest.volume_kg, 1605), dist.chest);
check(`distribution ${SQUAT.muscle_group}: 2 series, 775 kg`, dist[SQUAT.muscle_group]?.sets === 2 && near(dist[SQUAT.muscle_group].volume_kg, 775), dist[SQUAT.muscle_group]);
r = await call(A.token, "GET", "/analytics/distribution?by=equipment");
check("distribution por equipo: barra 5 series", r.body.find((d) => d.key === "barbell")?.sets === 5, r.body);
check("distribution from > to → 400", (await call(A.token, "GET", `/analytics/distribution?from=${iso(now)}&to=${iso(now - H)}`)).status === 400);
r = await call(A.token, "GET", "/analytics/prs");
check("prs: 2 ejercicios con 1RM Epley", r.body.length === 2 && near(r.body.find((p) => p.exercise_id === SQUAT.id).estimated_1rm_kg, 80 * (1 + 5 / 30), 0.1), r.body);
r = await call(A.token, "GET", `/analytics/exercise/${BENCH.id}/history`);
check("historial banca: 2 puntos ascendentes", r.body.points.length === 2 && r.body.points[0].workout_id === S1 && r.body.points[1].workout_id === S2.id, r.body.points);
check("historial: sesión 1 top 62.5×8, 980 kg, 2 series", r.body.points[0].top_weight_kg === 62.5 && r.body.points[0].top_reps === 8 && near(r.body.points[0].volume_kg, 980) && r.body.points[0].sets === 2, r.body.points[0]);
check("historial de ejercicio inexistente → 404", (await call(A.token, "GET", `/analytics/exercise/${randomUUID()}/history`)).status === 404);
r = await call(A.token, "GET", "/analytics/weekly-summary");
check("weekly-summary por defecto: semana pasada vacía, is_latest, racha 1", r.status === 200 && r.body.sessions === 0 && r.body.is_latest === true && r.body.current_streak === 1, r.body);
const monday = new Date(); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
check("weekly-summary de la semana en curso → 400", (await call(A.token, "GET", `/analytics/weekly-summary?week=${monday.toISOString().slice(0, 10)}`)).status === 400);
check("weekly-summary con un no-lunes → 400", (await call(A.token, "GET", `/analytics/weekly-summary?week=2026-10-07`)).status === 400);

section("Medallas y aislamiento");
r = await call(A.token, "GET", "/me/achievements");
const earned = r.body.filter((a) => a.earned_at).map((a) => a.id).sort();
check("vitrina: primera_sesion y primer_pr ganadas", JSON.stringify(earned) === JSON.stringify(["primer_pr", "primera_sesion"]), earned);
check("vitrina: progreso de sesiones_10 = 2/10", (() => { const s = r.body.find((a) => a.id === "sesiones_10"); return s && s.progress?.current === 2 && s.progress?.target === 10; })(), r.body.find((a) => a.id === "sesiones_10"));
check("B: sin workouts", (await call(B.token, "GET", "/workouts")).body.items.length === 0);
check("B: sin PRs ni volumen", (await call(B.token, "GET", "/analytics/prs")).body.length === 0 && (await call(B.token, "GET", "/analytics/volume?weeks=4")).body.every((w) => w.volume_kg === 0));

finish();
