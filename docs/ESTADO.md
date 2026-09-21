# ESTADO.md — Bitácora del proyecto

Registro de lo construido en las sesiones de planeación y generación, con las verificaciones ejecutadas. Fuente de verdad para retomar el trabajo. Última actualización: 2026-09-20.

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

### Semanas 7–9 — Logger de sesión activa ✅

La pantalla más importante (60% del valor percibido), wireframe en `docs/diseno-ui-ux.md` §6.2.

`/sesion` a pantalla completa fuera del shell (`app/sesion/layout.tsx`, sin tab bar), máquina de estados en
`components/sesion/use-active-session.ts`: arranque desde rutina (`GET /routines/:id`) o libre con picker,
reanudación de la sesión viva (`?resume=`) y una sola sesión activa a la vez. `SetRow` + `Stepper` de 56px
con press-and-hold, `TimerDescanso` XXL con notificación local, autocompletado con `GET /workouts/last-set/:id`,
RPE opcional, dato hero (peso) en display 64. Escritura local-first: cada serie completada escribe el documento
en Dexie y encola la intención en el outbox (los taps del stepper son efímeros hasta confirmar la serie, para no
inflar el outbox). Al finalizar: `ended_at`, flush del outbox y resumen con count-up (volumen, duración, series, PRs)
+ `TarjetaPR` con ignición. `SesionPildora` en el shell para minimizar y volver. Hoy lee red **y** Dexie y fusiona.

### Semanas 10–11 — Sync robusto, celebraciones diferidas y PWA ✅

- **Bug de pérdida de datos corregido** en `flushOutbox`: la confirmación borraba el outbox por `workout_id`,
  así que una serie completada mientras el POST estaba en vuelo se borraba sin haberse enviado nunca. Ahora se
  borran solo los `seq` que viajaron y el workout pasa a `synced` únicamente si no le queda ninguna entrada.
- `flushOutbox` serializado (una pasada en vuelo; si algo encola durante el vuelo se reencadena otra) y con
  cortocircuito offline.
- `lib/offline/sync-state.ts`: store observable (`phase`/`pending`/`online`) + bus de recompensas, consumido con
  `useSyncExternalStore`.
- `BarraSync` (`components/offline/barra-sync.tsx`): franja que solo aparece cuando hay algo que decir
  (sin conexión / sincronizando / pendientes) con copy sin culpa y botón de reintento.
- `CelebracionesDiferidas` en el shell (nunca en `/sesion`, que ya celebra en su resumen): descarga la cola de
  PRs, medallas y racha que devuelve el sync al reconectar (§8.3). `ACHIEVEMENT_LABELS` en `lib/labels.ts`.
- **Background Sync API**: `requestBackgroundSync()` al encolar; el SW despierta con el tag `forja-outbox` y avisa
  a los clientes por `postMessage` (el Bearer vive en la página, no en el SW). Si no hay clientes rechaza a
  propósito para que el navegador reintente. Triggers de respaldo: `online`, `visibilitychange` y arranque.
- **PWA instalada**: el inset del notch pasó de `<body>` (donde se sumaba a cada `min-h-dvh` y hacía scrollear la
  página un notch entero en iOS) a las utilidades `area-segura` / `area-segura-top` en los contenedores de altura
  completa; `/sesion` ya no duplicaba el inset. `apple-touch-icon` explícito (iOS ignora los iconos del manifest).

### Verificaciones ejecutadas (semanas 10–11)

| Prueba | Resultado |
|---|---|
| `pnpm typecheck` (shared + api + web) | ✅ |
| `pnpm build` (14 rutas, standalone) | ✅ |
| `pnpm test` — 4 jest (api) + 8 vitest (web) | ✅ |
| Tags `forja-outbox` / `forja-flush-outbox` presentes en `public/sw.js` compilado | ✅ |
| Test de regresión del outbox: falla con el código anterior, pasa con el nuevo | ✅ |

Tests de sync en `apps/web/lib/offline/sync.test.ts` (vitest + `fake-indexeddb`, Dexie real, `api` mockeada):
envío y marcado `synced`, compactación LWW de varias ediciones, **reintento** tras fallo de red,
**duplicado** (`skipped_stale` sin reencolar), **borrado offline**, la serie completada en vuelo que no se pierde,
mutex de flushes concurrentes y cortocircuito sin conexión.

> No re-verificado E2E contra Postgres real en esta sesión: las pruebas E2E de la tabla anterior siguen siendo
> las de las semanas 3–6. Conviene repetirlas antes de cerrar Fase 1.

## Siguiente: semanas 12–13 — Progreso real (EMPEZAR AQUÍ)

`/progreso` ya muestra datos reales: resumen semanal, volumen, grupos musculares, máquinas, récords y medallas. Falta el pase de accesibilidad.

- [x] API: `GET /analytics/distribution?from&to&by=muscle_group|equipment` (volumen y series por grupo
      **primario** o por equipo), `GET /analytics/prs` (desde `exercise_prs`, con 1RM estimado Epley),
      `GET /analytics/exercise/:id/history?limit=30` (por sesión: serie top, 1RM estimado, volumen, series;
      orden ascendente para graficar; 404 si el ejercicio no existe). Esquemas Zod en
      `packages/shared/src/schemas/analytics.ts`. Todas cuentan solo sets completados de sesiones terminadas.
      **Verificado E2E contra Postgres real (Supabase local, 2026-09-20): 23/23** — agregados exactos,
      exclusión de series incompletas y de la sesión en curso, filtro de rango, desempate por reps,
      `limit`, 400/404 legibles y aislamiento entre usuarios.
- [x] Gráfica de volumen por semana y selector de rango (4 / 12 semanas) conectada a `GET /analytics/volume`:
      `GraficaVolumen` (SVG propio, semana en curso en `--accent` plano, tooltip por barra, flechas de
      teclado, tabla `sr-only`, contraste de barras ≥3:1 en ambos temas), estados de carga/vacío/error y
      comparación contra la semana pasada sin % negativo mientras la semana sigue en curso. Helpers puros en
      `lib/progreso/volumen.ts` con 7 tests. 
- [x] Tarjeta de récords personales desde `GET /analytics/prs`: más reciente primero, 5 visibles + "Ver todos",
      fecha relativa, estados de carga/vacío/error. Es histórica (el selector de semanas no la acota).
      **Decisión del founder (2026-09-20):** PR = más peso por ejercicio (desempate por reps) y solo cuentan
      sesiones TERMINADAS. `detectPrs` ahora filtra `ended_at`; antes un sync a mitad de sesión (Background Sync
      tras cada serie) materializaba el PR y el resumen de `/sesion` mostraba 0 PRs. E2E 27/27.
- [x] Heatmap muscular (wireframe §6.2; el plan no tiene §6.4) desde `GET /analytics/distribution?by=muscle_group`,
      acotado por el selector de semanas. Mide **series**, no kg (el peso corporal registra 0 kg). Figura geométrica
      frente/espalda con 11 grupos; `full_body` y `cardio` como chips. Rampa secuencial de un tono `--heat-1..4`
      validada en ambos temas (en claro el último paso baja hacia la tinta para caber 4 pasos ≥2:1), 4 pasos
      relativos al grupo más trabajado, leyenda con rangos, flechas de teclado, tabla `sr-only`.
      Solo cuenta el grupo PRIMARIO del ejercicio (secundarios fuera).
- [x] Barras "por máquina" desde `GET /analytics/distribution?by=equipment`, acotadas por el selector: series por
      tipo de equipo, horizontales, ordenadas, valor en la punta, un solo gris (sin leyenda: una serie), tabla
      `sr-only` con series y kg.
- [x] Vitrina de medallas desde `GET /me/achievements` (catálogo completo + `earned_at` + progreso de las
      bloqueadas). Reglas de logros movidas a `@forja/shared` (`ACHIEVEMENT_RULES`): la MISMA fuente otorga en el
      sync y calcula el progreso en la vitrina. `prs_25` queda `measurable: false` (sin log de eventos de PR).
      Migración `0004_logros_acentos.sql` (acentos/ñ en nombres y descripciones sembrados en ASCII). UI: rombos por
      categoría con el metal de su tier (tokens `--tier-*` en `globals.css`, ≥3:1 en ambos temas), silueta con
      contraste ≥3:1 para las bloqueadas, detalle con barra de progreso gris (el oro solo para lo ganado); abre en la
      medalla más cercana a ganarse. E2E 36/36.
- [x] Resumen semanal: `GET /analytics/weekly-summary?week=YYYY-MM-DD` (lunes UTC; por defecto la última semana
      completa; 400 legible para semana en curso/no lunes) con sesiones vs objetivo, volumen vs semana anterior,
      series, PRs cuya sesión cayó en la semana, medallas ganadas en la semana y racha actual. Tarjeta arriba de
      `/progreso` con `AnilloForja` (igniciona solo si se cumplió el objetivo), copy sin culpa (semana corta = "Cada
      una suma"; 0 = "El descanso también es parte del entrenamiento"), flechas para semanas anteriores. El selector
      de rango bajó a una fila "Tendencias" encima de lo que sí acota. E2E 47/47.
      Limitaciones: `weekly_goal` es el ACTUAL (no hay histórico del objetivo); PRs superados después no aparecen en
      su semana (falta log de eventos de PR); la racha solo se muestra en la semana más reciente. Sin notificación
      push de los lunes: no hay infraestructura de push todavía.
- [~] Pase de accesibilidad (en curso, 2026-09-21). Hecho y verificado:
      - Contraste AA en tema claro: `--accent` #966418, `--fg-muted` #676d7b; tokens de estado `--positive`/`--danger`/
        `--warning` e ignición `--ignicion-desde/hasta` con versión clara ≥4.5:1; ya nadie usa la paleta cruda.
        Texto con opacidad (hint "(opcional)", series pendientes) pasado a `--fg-muted`.
      - Objetivos táctiles: 56 px en `/sesion`, 44 px en el resto (sin controles <44 px medidos a 300 px).
      - Nombres accesibles: switch "Perfil público", barra de progreso de medallas.
      - Foco visible en buscadores (`focus-within`); diálogos modales con foco dentro, Tab atrapado, Escape y retorno
        del foco (`useDialog`/`Dialogo`, los 5 modales).
      - Scroll horizontal en móvil causado por las tablas `sr-only` (una `<table>` ignora `width:1px`): ahora el
        `sr-only` va en un div.
      - axe-core 4.13 (WCAG 2.0/2.1/2.2 A+AA): **0 violaciones** en `/login`, `/onboarding` y `/progreso` completo
        (datos simulados), tema oscuro y claro. Layout de `/progreso` revisado a 300 px sin desbordes.
      Con sesión iniciada (rama en :3098/:3099, datos reales): **0 violaciones axe** en `/hoy`, `/entrenar`,
      `/entrenar/nueva`, `/ejercicios` (incl. chip activo y sheet de detalle), `/perfil`, `/progreso` y `/sesion`
      (vacía, picker y logger), ambos temas. Corregido en esta vuelta: enlace activo del sidebar y chip activo
      (oro sobre su tinte = 4.2:1 → texto `--fg`), chips de filtro a 44 px, logo del sidebar a 44 px, y en `/sesion`
      todo a 56 px: RPE en rejilla 3×3 con `aria-pressed` + grupo con nombre (antes 32 px y estado solo por color),
      enlaces de navegación, "Añadir ejercicio" y "Finalizar". Diálogos verificados con datos reales (foco, Escape,
      retorno). De paso: bug de `secondary_muscles` (llegaba como texto y rompía el detalle de ejercicio).
      Pendiente: lectores de pantalla reales (VoiceOver/TalkBack) y Lighthouse ≥95 sobre build de producción.

## Después (en orden)

1. Cierre de Fase 1: repetir la batería E2E contra Postgres real incluyendo el logger completo
   (sesión desde rutina → serie → finalizar → sync → recompensas) y el flujo offline extremo a extremo.
2. Fase 2 (social) y Fase 3 (Stripe + IA) según `docs/arquitectura.md` §7.

## Deuda técnica registrada

- `next/font` en lugar de `<link>` a Google Fonts (flash tipográfico).
- Drag & drop con handle en el builder (hoy flechas).
- `grace_weeks` de la racha y logro `prs_25` requieren log de eventos de PR (TODOs en `workouts.service.ts`).
- `skipped_stale` en cliente: traer copia del servidor y reemplazar la local (TODO en `lib/offline/sync.ts`).
- Splash screens de iOS (`apple-touch-startup-image`): requiere generar el set de imágenes por tamaño de pantalla.
- `SesionPildora` sondea Dexie cada 3 s; con `liveQuery` de Dexie sería reactivo y sin polling.
- Notificación del `TimerDescanso` solo con la pestaña viva; con el SW podría dispararse en segundo plano.
- Borrado de cuenta: falta borrar `auth.users` vía Admin API (TODO en `me.controller.ts`).
- CI: paso "push & deploy" comentado hasta decidir hosting.
- Semanas en UTC: el backend agrupa con `date_trunc('week')` en la zona de la BD (UTC); una sesión del domingo
  en la noche en México cae en la semana siguiente. Afecta gráfica y racha por igual.
- La gráfica de volumen no suma sesiones terminadas offline que aún no sincronizan (Hoy sí las fusiona desde
  Dexie); aparecen al sincronizar.
- Importar VALORES de `@forja/shared` en el cliente puede arrastrar zod (+14 kB medido en `/progreso` con
  `ACHIEVEMENT_METRICS`) pese a `sideEffects: false`. Preferir `import type`; revisar el build ESM de shared.
