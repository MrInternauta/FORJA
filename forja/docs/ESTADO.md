# ESTADO.md — Bitácora del proyecto

Registro de lo construido en las sesiones de planeación y generación, con las verificaciones ejecutadas. Fuente de verdad para retomar el trabajo. Última actualización: 2026-07-18.

## Decisiones de contexto confirmadas

| Tema | Decisión |
|---|---|
| Escala año 1 | ~20k registrados / ~2k DAU |
| Equipo | 1 dev (solo founder) |
| Plazo MVP / infra | 12–16 semanas / $50–200 USD/mes |
| Región | LATAM (es-MX), sin requisitos regulatorios especiales; unidades en kg |
| Pagos (Fase 3) | Stripe recomendado; aislado en futuro `BillingModule` (pregunta abierta #1 sin cerrar) |
| Hosting backend | Contenedores gestionados (Fly.io/Railway) recomendado (pregunta abierta #3 sin cerrar) |
| Racha | **Semanal** contra objetivo configurable 1–7 (no diaria); semanas de gracia ganadas (TODO v2) |

## Preguntas abiertas AÚN sin respuesta del founder

1. ¿Tarjeta internacional (Stripe) basta o hace falta OXXO/SPEI (Mercado Pago)?
2. Origen de la media del catálogo (propia / licenciada / catálogo reducido inicial).
3. Hosting definitivo del backend (afecta el paso "push & deploy" comentado en CI).
4. Proveedor LLM para Fase 3.
5. Visibilidad por defecto: implementado **privado por defecto** con opt-in (`is_public`), confirmar.

## Hecho y verificado

### Fase 0 — Fundaciones ✅
Monorepo (pnpm+turbo), `@forja/shared`, Containerfiles multi-stage (pnpm deploy / Next standalone), CI, migraciones completas (15 tablas, **25 políticas RLS**, hook `custom_access_token`, seeds: 15 logros + 14 ejercicios), tokens FORJA en Tailwind v4, shell responsive, `AnilloForja`, SW Serwist con la política de caché del plan, iconos PWA.

### Semanas 3–4 ✅
`AuthGate` (sin sesión→/login; sin perfil→/onboarding; contexto `useMe()`), onboarding de username, Hoy con datos reales (racha, objetivo, sesiones de la semana, última sesión), Perfil (objetivo editable PATCH optimista, toggle público, logout), `/ejercicios` (búsqueda debounce, chips, keyset "Cargar más", detalle en sheet, alta ADMIN).

### Semanas 5–6 ✅
API `routines` (list/detail/POST/PUT-reemplazo/DELETE, transaccional), `PLAN_LIMITS` compartido (FREE: 5 rutinas) aplicado en backend y mostrado en frontend, builder de rutinas (picker en sheet, series objetivo reps/kg/RPE, reorden con flechas —TODO drag&drop—, guardar fijo inferior, editar/borrar), `docker-compose.yml` único con `db` autoprovisionada (stubs auth + migraciones al primer arranque del volumen; puerto 54322 ⇒ misma `DATABASE_URL` que `supabase start`).

### Verificaciones E2E ejecutadas (Postgres 16 real + API compilada + JWT HS256)

| Prueba | Resultado |
|---|---|
| Migraciones con `ON_ERROR_STOP` | ✅ 15 tablas, 25 políticas, seeds OK |
| 401 sin token / 404 pre-onboarding / onboarding / `GET /me` | ✅ |
| Catálogo filtrado por grupo muscular | ✅ |
| FREE en endpoint ADMIN (`POST /exercises`) | ✅ 403 |
| Sync de workout offline → recompensas | ✅ PR 82.5×8 detectado; medallas `primera_sesion` + `primer_pr` |
| Reenvío idéntico del sync | ✅ `skipped_stale`, cero recompensas duplicadas |
| `GET /analytics/volume` | ✅ 1,300 kg exactos (80×8 + 82.5×8) |
| Rutinas: crear → listar → detalle anidado → PUT reemplazo | ✅ (5×90 kg confirmado tras PUT) |
| 6ª rutina FREE | ✅ 422 con copy sin culpa |
| `exercise_id` inexistente | ✅ 400 legible |
| DELETE rutina | ✅ 204, recuento correcto |

## Siguiente: semanas 7–9 — Logger de sesión activa (EMPEZAR AQUÍ)

La pantalla más importante (60% del valor percibido). Wireframe en `docs/diseno-ui-ux.md` §6.2.

- [ ] Ruta `/sesion` a pantalla completa (sin tab bar; salir = minimizar a píldora o finalizar).
- [ ] Flujos de inicio: desde rutina (`GET /routines/:id` precarga ejercicios/series objetivo) y libre (vacío + picker).
- [ ] `SetRow` real: peso · reps · RPE · check; autocompletar con el último peso usado en ese ejercicio.
- [ ] `StepperPeso` (±2.5 kg) / `StepperReps` (±1) de 56px con press-and-hold acelerado.
- [ ] `TimerDescanso` display XXL editable; notificación local al llegar a 0.
- [ ] Un dato hero (peso actual) en display 64; una sola decisión visible: la siguiente serie.
- [ ] **Local-first**: cada mutación escribe en Dexie (`lib/offline/db.ts`) + entrada en outbox; `registerSyncTriggers` ya existe en `lib/offline/sync.ts`.
- [ ] Al finalizar: `ended_at`, flush del outbox, pantalla de resumen con count-up (volumen, duración, PRs) usando `rewards` de la respuesta.
- [ ] Celebración de PR: ignición + `TarjetaPR` (variante estática con reduced-motion).
- [ ] Historial en Hoy debe leer de Dexie con fallback a red (hoy solo lee red).

## Después (en orden)

1. Semanas 10–11: celebraciones diferidas post-sync, Background Sync API, `BarraSync`, pulido PWA instalada (safe areas, splash), tests de integración de sync (reintento, duplicado, borrado offline).
2. Semanas 12–13: Progreso real (`/analytics/volume` ya existe; añadir `distribution`, `prs`, `exercise/:id/history`), heatmap muscular, vitrina real de medallas (`user_achievements`), resumen semanal, pase de accesibilidad completo.
3. Fase 2 (social) y Fase 3 (Stripe + IA) según `docs/arquitectura.md` §7.

## Deuda técnica registrada

- `next/font` en lugar de `<link>` a Google Fonts (flash tipográfico).
- Drag & drop con handle en el builder (hoy flechas).
- `grace_weeks` de la racha y logro `prs_25` requieren log de eventos de PR (TODOs en `workouts.service.ts`).
- `skipped_stale` en cliente: traer copia del servidor y reemplazar la local (TODO en `lib/offline/sync.ts`).
- Borrado de cuenta: falta borrar `auth.users` vía Admin API (TODO en `me.controller.ts`).
- CI: paso "push & deploy" comentado hasta decidir hosting.
