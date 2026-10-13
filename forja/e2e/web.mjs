// E2E de navegador — logger completo y flujo offline contra el build de PRODUCCIÓN (SW activo).
// Requisitos: `supabase start`, API en :3001 y web en :3000 con `pnpm build` + `pnpm --filter @forja/web start`
// (en dev el SW está desactivado). Chrome local (CHROME_PATH para otra ruta).
// Uso: pnpm --filter @forja/e2e e2e:web
import fs from "node:fs";
import puppeteer from "puppeteer-core";
import { call, check, config, finish, knownIssue, near, newUser, onboard, section, sleep } from "./lib.mjs";

const WEB = config.web;
const SHOTS = new URL("./shots/", import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });

/* ===== Usuario y rutina de prueba ===== */
const user = await newUser("web");
await onboard(user, `e2e_web_${String(Date.now()).slice(-8)}`);
const api = (method, path, body) => call(user.token, method, path, body);
const cat = (await api("GET", "/exercises")).body.items;
const BENCH = cat.find((e) => e.name === "Press banca");
const SQUAT = cat.find((e) => e.name === "Sentadilla trasera");
const ROUTINE_NAME = "E2E Fuerza";
await api("POST", "/routines", {
  name: ROUTINE_NAME,
  exercises: [
    { exercise_id: BENCH.id, position: 1, sets: [{ position: 1, target_reps: 8, target_weight_kg: 60 }, { position: 2, target_reps: 8, target_weight_kg: 62.5 }] },
    { exercise_id: SQUAT.id, position: 2, sets: [{ position: 1, target_reps: 5, target_weight_kg: 80 }] },
  ],
});

/* ===== Navegador ===== */
const browser = await puppeteer.launch({ executablePath: config.chrome, headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

const text = () => page.evaluate(() => document.body.innerText);
const waitText = (re, timeout = 15000) =>
  page.waitForFunction((src) => new RegExp(src, "i").test(document.body.innerText), { timeout }, re.source);
const shot = (n) => page.screenshot({ path: `${SHOTS}${n}.png` });
async function clickLabel(label) {
  const el = await page.waitForSelector(`[aria-label="${label}"]`, { visible: true, timeout: 10000 });
  await el.click();
}
async function clickText(t) {
  const h = await page.waitForFunction(
    (t) => [...document.querySelectorAll("button, a")].find((b) => b.innerText.trim() === t && b.offsetParent !== null),
    { timeout: 10000 },
    t,
  );
  await h.asElement().click();
}
/** IndexedDB "forja" leída directamente (Dexie no está expuesto en window). */
const idb = () =>
  page.evaluate(
    () =>
      new Promise((res, rej) => {
        const req = indexedDB.open("forja");
        req.onerror = () => rej(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const out = {};
          const tx = db.transaction(["workouts", "outbox"], "readonly");
          tx.objectStore("workouts").getAll().onsuccess = (e) => (out.workouts = e.target.result);
          tx.objectStore("outbox").getAll().onsuccess = (e) => (out.outbox = e.target.result);
          tx.oncomplete = () => {
            db.close();
            res(out);
          };
        };
      }),
  );
/** Sondea hasta que `fn` devuelva algo truthy; tolera navegaciones en curso. */
async function waitFor(fn, timeout = 15000, every = 300) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    let v = null;
    try {
      v = await fn();
    } catch {
      /* contexto destruido por una navegación */
    }
    if (v) return v;
    await sleep(every);
  }
  return null;
}
const completedSets = (w) => w.exercises.flatMap((e) => e.sets).filter((s) => s.is_completed).length;

try {
  section("Login y service worker");
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle0" });
  await page.type("input[type=email]", user.email);
  await page.type("input[type=password]", user.password);
  await Promise.all([page.waitForFunction(() => location.pathname === "/hoy", { timeout: 20000 }), page.click("button[type=submit]")]);
  check("login → /hoy", true);
  const swReady = await page.evaluate(async () => {
    const r = await Promise.race([navigator.serviceWorker.ready, new Promise((res) => setTimeout(() => res(null), 10000))]);
    return !!r?.active;
  });
  check("service worker activo", swReady);
  // Precalentar el caché del SW con las rutas que se usarán offline
  for (const p of ["/entrenar", "/hoy", "/sesion"]) await page.goto(`${WEB}${p}`, { waitUntil: "networkidle0" });

  section("Sesión online desde rutina");
  await page.goto(`${WEB}/entrenar`, { waitUntil: "networkidle0" });
  await clickLabel(`Empezar ${ROUTINE_NAME}`);
  await page.waitForFunction(() => location.pathname === "/sesion", { timeout: 10000 });
  await waitText(/Press banca/);
  check("arranca en /sesion con la rutina", /Press banca/i.test(await text()));
  check("peso precargado de la rutina (60)", /\b60\b/.test(await text()));
  for (let i = 0; i < 3; i++) {
    await clickText("COMPLETAR SERIE");
    await sleep(400);
  }
  let local = await idb();
  check("cada serie escribe en IndexedDB (local-first)", local.workouts.length === 1 && completedSets(local.workouts[0]) === 3);
  await clickText("Finalizar entrenamiento");
  await waitText(/ENTRENAMIENTO TERMINADO/);
  await sleep(1500); // count-up
  await shot("01-online-resumen");
  let t = await text();
  check("resumen: volumen 1,380 kg", /1,380\s*kg/.test(t), t.slice(0, 200));
  check("resumen: 3 series", /\b3\s*\n?\s*series/.test(t));
  let prCards = 0;
  while (/Continuar/.test(await text()) && prCards < 5) {
    await clickText("Continuar");
    prCards++;
    await sleep(400);
  }
  check("2 tarjetas de PR (banca y sentadilla)", prCards === 2, prCards);
  local = await waitFor(async () => {
    const l = await idb();
    return l.outbox.length === 0 && l.workouts.every((w) => w.sync_status === "synced") ? l : null;
  });
  check("outbox vacío y workout synced", !!local);
  let server = (await api("GET", "/workouts")).body.items;
  check("servidor: 1 sesión terminada, 3 series, 1380 kg", server.length === 1 && server[0].ended_at && server[0].sets_completed === 3 && near(server[0].volume_kg, 1380), server);
  await clickText("Ir a Hoy");
  await page.waitForFunction(() => location.pathname === "/hoy", { timeout: 10000 });
  await sleep(2500);
  check("Hoy no repite la celebración (sin diálogo)", !(await page.$('[role="dialog"]')));

  section("Sesión con corte de red a mitad");
  await page.goto(`${WEB}/entrenar`, { waitUntil: "networkidle0" });
  await clickLabel(`Empezar ${ROUTINE_NAME}`);
  await page.waitForFunction(() => location.pathname === "/sesion", { timeout: 10000 });
  await waitText(/Press banca/);
  await clickText("COMPLETAR SERIE"); // 1ª serie, online
  await waitFor(async () => (await idb()).outbox.length === 0, 10000);
  const W2 = (await idb()).workouts.find((w) => !w.ended_at)?.id;
  check("2ª sesión: la 1ª serie ya está en el servidor", (await api("GET", "/workouts")).body.items.some((w) => w.id === W2 && w.sets_completed === 1));

  await page.setOfflineMode(true);
  await sleep(300);
  check("navegador offline", await page.evaluate(() => !navigator.onLine));
  await clickLabel("Aumentar peso"); // 62.5 → 65: PR al reconectar
  await sleep(200);
  await clickText("COMPLETAR SERIE");
  await sleep(400);
  check("offline: la serie queda en el outbox", (await idb()).outbox.length >= 1);

  // Recarga dura sin red con la URL de arranque (?routine=): debe reanudar en su sitio
  check("la URL de la sesión sigue siendo ?routine=", /\/sesion\?routine=/.test(page.url()), page.url());
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  await waitFor(async () => /Sentadilla trasera/i.test(await text()), 10000);
  await shot("02-offline-recarga");
  t = await text();
  check("recarga offline: la sesión se reanuda (Sentadilla pendiente)", /Sentadilla trasera/i.test(t), t.slice(0, 200));
  check("recarga offline: la URL pasa a ?resume=<id> sin navegar", page.url().endsWith(`/sesion?resume=${W2}`), page.url());
  check("recarga offline: el outbox sobrevive", (await idb()).outbox.length >= 1);

  await clickText("COMPLETAR SERIE"); // sentadilla, offline
  await sleep(400);
  await clickText("Finalizar entrenamiento");
  await waitText(/ENTRENAMIENTO TERMINADO/);
  await sleep(1500);
  await shot("03-offline-resumen");
  t = await text();
  check("resumen offline: copy sin culpa de sin conexión", /Sin conexión: tu entrenamiento se guardó/.test(t), t.slice(0, 300));
  check("resumen offline: volumen local 1,400 kg", /1,400\s*kg/.test(t), t.slice(0, 200));
  server = (await api("GET", "/workouts")).body.items.find((w) => w.id === W2);
  check("servidor aún sin la sesión terminada", server && !server.ended_at && server.sets_completed === 1, server);

  await clickText("Ir a Hoy");
  await waitFor(async () => /Sin conexión/.test(await text()), 10000);
  await shot("04-offline-hoy");
  t = await text();
  check("offline: Hoy carga", /Empezar|ÚLTIMA SESIÓN/i.test(t), t.slice(0, 200));
  check("offline: BarraSync en singular (1 sesión guardada aquí)", /Sin conexión · 1 sesión guardada aquí/.test(t), t.slice(0, 120));

  section("Reconexión");
  await page.setOfflineMode(false);
  local = await waitFor(async () => ((await idb()).outbox.length === 0 ? true : null), 20000);
  check("al reconectar el outbox se vacía solo", !!local);
  server = (await api("GET", "/workouts")).body.items.find((w) => w.id === W2);
  check("servidor: sesión terminada, 3 series, 1400 kg", server?.ended_at && server.sets_completed === 3 && near(server.volume_kg, 1400), server);
  const dlg = await waitFor(
    async () => ((await page.$('[role="dialog"]')) ? page.evaluate(() => document.querySelector('[role="dialog"]').innerText) : null),
    10000,
  );
  await shot("05-reconexion");
  knownIssue(
    "celebración diferida del PR (banca 65)",
    !!dlg && /Press banca/i.test(dlg) && /65/.test(dlg),
    "la respuesta del sync que aplicó la sesión se perdió en una navegación; el reintento da skipped_stale sin recompensas (ESTADO: deuda)",
  );
  for (let n = 0; (await page.$('[role="dialog"]')) && n < 5; n++) {
    await clickText("Continuar");
    await sleep(500);
  }
  const prs = (await api("GET", "/analytics/prs")).body;
  check("analytics: PR banca 65×8", prs.some((p) => p.exercise_id === BENCH.id && p.weight_kg === 65 && p.reps === 8), prs);
  const stats = (await api("GET", "/me")).body.stats;
  check("stats: 2 sesiones, 2780 kg", stats.total_workouts === 2 && near(stats.total_volume_kg, 2780), stats);
  await sleep(1500);
  check("BarraSync desaparece cuando no hay nada que decir", !/Sin conexión|Sincronizando|pendiente/i.test(await text()));
  check("sin errores de JS en la página", pageErrors.length === 0, pageErrors);
} catch (e) {
  // Un paso que no se pudo dar (p. ej. pantalla en blanco) cuenta como falla y no oculta el resumen.
  check("la corrida llegó al final", false, String(e.message).split("\n")[0]);
} finally {
  await browser.close();
  finish();
}
