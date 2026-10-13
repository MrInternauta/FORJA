// Utilidades compartidas de los E2E: configuración, arnés de checks y usuarios de prueba.
import { execSync } from "node:child_process";

/** Claves de Supabase: del entorno o, si faltan, de `supabase status` (stack local). */
function supabaseKeys() {
  if (process.env.SUPA_ANON && process.env.SUPA_SERVICE) {
    return { anon: process.env.SUPA_ANON, service: process.env.SUPA_SERVICE };
  }
  const out = execSync("supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const get = (k) => out.match(new RegExp(`^${k}="?([^"\\n]+)"?`, "m"))?.[1];
  const anon = get("ANON_KEY"), service = get("SERVICE_ROLE_KEY");
  if (!anon || !service) throw new Error("Sin claves de Supabase: corre `supabase start` o define SUPA_ANON y SUPA_SERVICE");
  return { anon, service };
}

export const config = {
  api: process.env.API_URL ?? "http://localhost:3001/v1",
  web: process.env.WEB_URL ?? "http://localhost:3000",
  supabase: process.env.SUPA_URL ?? "http://127.0.0.1:54321",
  chrome: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ...supabaseKeys(),
};

/* ===== Arnés ===== */

let pass = 0;
const fails = [];
const known = [];
const show = (d) => (d === undefined ? "" : ` — ${typeof d === "string" ? d : JSON.stringify(d)}`);

export function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fails.push(name);
    console.log(`  ✗ ${name}${show(detail)}`);
  }
}

/** Fallo conocido y documentado (docs/ESTADO.md): se informa sin tumbar la corrida. Si pasa, avisa. */
export function knownIssue(name, cond, reason) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name} (era un fallo conocido: ¿ya se corrigió? actualiza ESTADO)`);
  } else {
    known.push(name);
    console.log(`  ~ ${name} — CONOCIDO: ${reason}`);
  }
}

export const section = (t) => console.log(`\n## ${t}`);
export const near = (a, b, eps = 0.01) => typeof a === "number" && Math.abs(a - b) <= eps;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function finish() {
  console.log(`\n${pass}/${pass + fails.length} OK${known.length ? ` · ${known.length} conocido(s)` : ""}`);
  if (fails.length) {
    console.log("FALLAS:");
    for (const f of fails) console.log(`  - ${f}`);
  }
  process.exit(fails.length ? 1 : 0);
}

/* ===== HTTP y usuarios ===== */

export async function call(token, method, path, body) {
  const res = await fetch(`${config.api}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

export async function signIn(email, password) {
  const r = await fetch(`${config.supabase}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: config.anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`login falló: ${JSON.stringify(j)}`);
  return j.access_token;
}

/** Usuario nuevo y confirmado en Supabase Auth (Admin API). Cada corrida usa correos únicos. */
export async function newUser(tag) {
  const email = `e2e-${Date.now()}-${tag}@forja.test`;
  const password = "E2e-Password-2026!";
  const r = await fetch(`${config.supabase}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: config.service, Authorization: `Bearer ${config.service}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const u = await r.json();
  if (!u.id) throw new Error(`no se pudo crear el usuario: ${JSON.stringify(u)}`);
  return { id: u.id, email, password, token: await signIn(email, password) };
}

/** Onboarding + token nuevo: el claim `user_role` lo pone el hook al EMITIR el token. */
export async function onboard(user, username) {
  const r = await call(user.token, "POST", "/auth/onboarding", { username });
  user.token = await signIn(user.email, user.password);
  return r;
}
