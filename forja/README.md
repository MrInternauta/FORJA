# FORJA — PWA de registro y seguimiento de entrenamientos

Monorepo del proyecto según el **documento de arquitectura** y el **plan de diseño UI/UX (sistema FORJA)**. Estado: **Fase 0 completada + semanas 3–11 de Fase 1** — onboarding, Hoy/Perfil con datos reales, catálogo con filtros y CRUD ADMIN, builder de rutinas, **logger de sesión activa** y sincronización offline con celebraciones diferidas.

Las semanas 3–6 están verificadas E2E contra PostgreSQL 16 real (onboarding → catálogo → sync → recompensas → idempotencia); las 7–11 con typecheck, build y tests automatizados. Ver `docs/ESTADO.md` para el detalle.

## Documentación y contexto

- `docs/arquitectura.md` — documento rector de arquitectura (modelo de datos, contratos, auth, offline, roadmap, riesgos).
- `docs/diseno-ui-ux.md` — sistema de diseño FORJA (tokens, wireframes, animaciones, gamificación).
- `docs/ESTADO.md` — bitácora: hecho, verificado E2E y siguiente tarea.
- `CLAUDE.md` — contexto para asistentes de IA en el editor (convenciones que no se rompen).
- `CHANGELOG.md` — cambios por versión (formato Keep a Changelog).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router) como PWA · Tailwind CSS v4 · Serwist · Dexie (IndexedDB) · next-themes |
| Backend | NestJS 11 · pg · validación Zod compartida |
| Datos / Auth / Storage | Supabase (PostgreSQL con RLS, Auth con hook de rol, Storage) |
| Contenedores | Podman + podman-compose (imágenes OCI multi-stage) |
| CI/CD | GitHub Actions: `CI` (typecheck → build → test → imágenes OCI) + `ESLint` (escaneo a Code scanning) |
| Monorepo | pnpm workspaces + Turborepo, tipos compartidos en `@forja/shared` |
| Calidad | TypeScript estricto · ESLint 9 (flat config) · Jest (api) + Vitest con `fake-indexeddb` (web) |

## Estructura

El monorepo vive en `forja/`, un nivel por debajo de la raíz del repositorio:

```
FORJA/                        <- raíz del repositorio git
  .github/workflows/          <- ci.yml, eslint.yml, dependency-review.yml
  forja/                      <- este monorepo
    apps/
      api/                    NestJS: auth (JWT+roles), me, exercises, routines,
                              workouts+sync, analytics
      web/                    Next.js PWA: tokens FORJA, shell responsive, SW,
                              logger de sesión, outbox offline
    packages/
      shared/                 Enums espejo de Postgres + esquemas Zod
    supabase/
      migrations/             DDL (15 tablas) + 25 políticas RLS + hook de token
                              + gamificación + seeds
    eslint.config.mjs, docker-compose.yml, infra/db-init/, .env.example
```

> **Importante:** GitHub Actions solo descubre workflows en `.github/workflows/`
> de la **raíz del repositorio**. Por eso viven en `FORJA/.github/workflows/` y
> no dentro de `forja/`; los jobs usan `working-directory: forja`.

## Puesta en marcha (desarrollo)

Requisitos: Node 22+, pnpm (via corepack), [Supabase CLI](https://supabase.com/docs/guides/cli), Podman (solo para paridad de producción).

```bash
corepack enable
pnpm install

# 1) Supabase local (Postgres + Auth + Storage) y migraciones
supabase start          # anota anon key y URLs que imprime
supabase db reset       # aplica supabase/migrations/*

# 2) Variables de entorno
cp .env.example .env    # rellena NEXT_PUBLIC_SUPABASE_ANON_KEY con la anon key local

# 3) Activar el hook de rol (una vez):
#    - Local: en supabase/config.toml -> [auth.hook.custom_access_token] enabled=true,
#      uri="pg-functions://postgres/public/custom_access_token" y `supabase stop && supabase start`
#    - Cloud: Dashboard > Authentication > Hooks > Custom Access Token -> public.custom_access_token

# 4) Levantar todo
pnpm dev                # web en :3000, api en :3001 (prefijo /v1)
```

### Base de datos: dos modos (misma `DATABASE_URL`)

Ambos exponen Postgres en `127.0.0.1:54322`, así que la `DATABASE_URL` del `.env` sirve igual en los dos:

| Modo | Comando | Qué incluye |
|---|---|---|
| **A. Stack Supabase** | `supabase start` + `supabase db reset` | Postgres + Auth + Storage + Studio (el camino "real") |
| **B. Solo Postgres** | `docker compose up db` (o `podman-compose up db`) | Postgres 16 con stubs del esquema `auth` y **las migraciones aplicadas automáticamente** al primer arranque del volumen |

En el modo B no hay Supabase Auth: define `SUPABASE_JWT_SECRET` en `.env` (p. ej. `forja-dev-secret`) y firma tokens de prueba HS256 con `sub` = un uuid insertado en `auth.users` y claim `user_role`. Es exactamente el modo con el que se smoke-testea la API en CI/desarrollo. Para re-aplicar migraciones desde cero: `docker compose down -v && docker compose up db`.

Paridad de producción (mismas imágenes OCI que CI, con la DB incluida):

```bash
docker compose up --build      # o podman-compose up --build
```

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | web + api en watch |
| `pnpm build` | build de shared → api → web (orquestado por turbo) |
| `pnpm typecheck` | TS estricto en los tres paquetes |
| `pnpm test` | Jest en api (RolesGuard) + Vitest en web (outbox/sync sobre Dexie real) |
| `pnpm lint` | ESLint 9 en todo el monorepo |

## Qué está implementado (mapa contra los documentos)

**Arquitectura**
- §3 Modelo de datos: migraciones con DDL íntegro, índices y **todas** las políticas RLS (incluidas las heredadas por `EXISTS` de routine_sets / workout_exercises / workout_sets).
- §5 Auth: guard JWT contra JWKS de Supabase (o HS256 legacy), claim `user_role` vía Custom Access Token Hook, `@Roles()` + RolesGuard globales, onboarding.
- §4 Contratos: `/health`, `/auth/onboarding`, `/me`, `/exercises` (paginación keyset y escritura ADMIN), `/routines` (CRUD con reemplazo transaccional), `/workouts` (+ `/workouts/last-set/:exerciseId`), **`/sync/workouts`** y `/analytics/volume`.
- §6 Offline: LWW por `client_updated_at` con upsert idempotente transaccional en el servidor; outbox Dexie + `flushOutbox()` serializado en el cliente, con compactación por workout, confirmación por `seq` y triggers `online` / `visibilitychange` / Background Sync.

**Plan de diseño**
- §3 Tokens FORJA en Tailwind v4 (dark-first + tema claro semántico), utilidades `texto-display`, `texto-dato`, `superficie`, `vidrio`.
- §5/§6 Shell responsive (tab bar translúcida móvil / sidebar desktop), pantallas Hoy·Entrenar·Progreso·Perfil según wireframes, `AnilloForja` (firma visual con ignición), chip de racha, reduced-motion global.
- §8 Recompensas server-side: PRs materializados, recálculo de stats y racha semanal, otorgamiento de medallas; el sync devuelve `rewards` para celebraciones diferidas.
- PWA: manifest + iconos (incl. maskable) + Service Worker con la política de caché del documento.

## Hecho en semanas 3–4

- `AuthGate`: guardia del shell — sin sesión → /login; sin perfil (404 de /me) → /onboarding; contexto `useMe()` para todas las pantallas.
- Onboarding de username (validación compartida con el backend vía Zod, manejo de 409).
- **Hoy** con datos reales: racha y objetivo de `GET /me`, sesiones de la semana y última sesión de `GET /workouts`, ignición del Anillo al cumplir la semana.
- **Perfil**: objetivo semanal editable (PATCH optimista con revert), toggle de perfil público, badge de rol, logout.
- **/ejercicios**: búsqueda con debounce, chips por grupo muscular, paginación keyset ("Cargar más"), detalle en sheet, y alta de ejercicios para ADMIN (403 verificado para FREE).

## Hecho en semanas 5–6

- API `routines`: listado keyset, detalle con hijos anidados, `POST`/`PUT` (reemplazo completo) transaccionales, `DELETE`, mapeo FK→400 legible.
- **Límites de plan** (tercera capa de autorización, arquitectura §5): `PLAN_LIMITS` en `@forja/shared` como fuente única — el backend lo aplica (422 en la 6ª rutina FREE, verificado E2E), el frontend solo lo muestra.
- Builder de rutinas en UI: selector de ejercicios en sheet (búsqueda + chips), series objetivo (reps/kg/RPE), reordenar, añadir/quitar series, guardar fijo inferior, edición y borrado. Reordenar es con flechas; TODO drag&drop con handle.
- Entrenar lista rutinas reales con aviso de límite; alta deshabilitada al tope.
- `docker-compose.yml` único (docker y podman) con servicio `db` que aplica stubs + migraciones al primer arranque; `.env.example` documenta los dos modos con **una sola `DATABASE_URL`**.
- Smoke E2E de rutinas: crear → listar → detalle → PUT → 422 de límite → 400 por ejercicio inexistente → DELETE.

## Hecho en semanas 7–9 — logger de sesión activa

La pantalla más importante del producto (plan de diseño §6.2): pantalla completa, sin navegación que compita.

- `/sesion` fuera del shell; salir **minimiza** a una píldora flotante que permite volver, y la sesión sigue viva en Dexie.
- Arranque **desde rutina** (`GET /routines/:id` precarga ejercicios y series objetivo) o **libre** con selector; una sola sesión activa a la vez, reanudable tras recargar (`?resume=`).
- `SetRow` + steppers de 56 px con press-and-hold acelerado, `TimerDescanso` en display XXL con notificación local, RPE opcional y autocompletado con el último peso usado (`GET /workouts/last-set/:id`).
- **Local-first**: cada serie completada escribe el documento en Dexie y encola la intención en el outbox. Los taps del stepper son efímeros hasta confirmar la serie, para no inflar la cola.
- Al finalizar: `ended_at`, flush del outbox y resumen con count-up (volumen, duración, series, PRs) + `TarjetaPR` con ignición.

## Hecho en semanas 10–11 — sync robusto, celebraciones diferidas y PWA

- **Corregida una pérdida de datos en el outbox**: la confirmación del servidor borraba las entradas por `workout_id`, así que una serie completada *mientras el POST estaba en vuelo* se eliminaba sin haberse enviado nunca. Ahora se borran solo los `seq` que viajaron, y el workout pasa a `synced` únicamente cuando no le queda ninguna entrada. Cubierto por un test de regresión.
- `flushOutbox()` serializado (una sola pasada en vuelo; lo que se encole durante el vuelo reencadena otra) y con cortocircuito sin conexión.
- **`BarraSync`**: franja que solo aparece cuando hay algo que decir (sin conexión / sincronizando / pendientes), con copy sin culpa y botón de reintento.
- **Celebraciones diferidas** (§8.3): si entrenaste sin conexión, los PRs, medallas y racha que devuelve el sync se celebran al reconectar, en el shell — nunca en `/sesion`, que ya celebra en su resumen.
- **Background Sync API**: el Service Worker despierta con el tag `forja-outbox` y avisa a los clientes (el Bearer vive en la página, no en el SW); `online`, `visibilitychange` y el arranque son la red de seguridad.
- **PWA instalada**: el inset del notch pasó de `<body>` —donde se sumaba a cada `min-h-dvh` y hacía scrollear la página un notch entero en iOS— a las utilidades `area-segura` / `area-segura-top`; `apple-touch-icon` explícito.
- **Tests de sync** (`lib/offline/sync.test.ts`, Vitest + `fake-indexeddb` sobre Dexie real): reintento, duplicado (`skipped_stale`), borrado offline, compactación LWW, mutex de flushes y la regresión de la serie en vuelo.

## Siguiente en el roadmap (Fase 1)

1. **Semanas 12–13 (siguiente): Progreso real.** `/progreso` sigue siendo un placeholder y el backend solo expone `GET /analytics/volume`; faltan `distribution`, `prs` y `exercise/:id/history`, la gráfica de volumen, el heatmap muscular, la vitrina de medallas desde `user_achievements`, el resumen semanal y el pase de accesibilidad completo.
2. Cierre de Fase 1: repetir la batería E2E contra Postgres real incluyendo el logger completo y el flujo offline extremo a extremo.
3. Fase 2 (social) y Fase 3 (Stripe + IA) según `docs/arquitectura.md` §7.

## Notas y decisiones abiertas

- Fuentes vía `<link>` (runtime): migrar a `next/font` para eliminar el flash tipográfico (TODO perf).
- `grace_weeks` (semana de gracia de la racha) y el logro `prs_25` requieren log de eventos de PR: marcados con TODO en `workouts.service.ts`.
- El job `image` de CI construye las imágenes en cada PR y en `main`; el push al registry queda pendiente de decidir hosting (pregunta abierta #3 del documento de arquitectura). Al añadirlo, ese paso sí debe gatearse a `main`.
- `pnpm deploy` usa `--legacy` en el Containerfile de la API: desde pnpm v10 exige `inject-workspace-packages=true`, que cambiaría el enlazado de `@forja/shared` en desarrollo (copia en vez de symlink).
- ESLint reporta 5 avisos a Code scanning sin bloquear el build (fuente custom de Google Fonts, dos dependencias de hooks deliberadamente parciales y dos directivas `eslint-disable` sin uso).
