# FORJA — PWA de registro y seguimiento de entrenamientos

Monorepo del proyecto según el **documento de arquitectura** y el **plan de diseño UI/UX (sistema FORJA)**. Estado: **Fase 0 completada + semanas 3-6 de Fase 1** (sesión real, onboarding, Hoy/Perfil con datos, catálogo con filtros y CRUD ADMIN). Migraciones validadas contra PostgreSQL 16 real y API verificada con smoke E2E (onboarding → catálogo → sync → recompensas → idempotencia).

## Documentación y contexto

- `docs/arquitectura.md` — documento rector de arquitectura (modelo de datos, contratos, auth, offline, roadmap, riesgos).
- `docs/diseno-ui-ux.md` — sistema de diseño FORJA (tokens, wireframes, animaciones, gamificación).
- `docs/ESTADO.md` — bitácora: hecho, verificado E2E y siguiente tarea.
- `CLAUDE.md` — contexto para asistentes de IA en el editor (convenciones que no se rompen).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router) como PWA · Tailwind CSS v4 · Serwist · Dexie (IndexedDB) · next-themes |
| Backend | NestJS 11 · pg · validación Zod compartida |
| Datos / Auth / Storage | Supabase (PostgreSQL con RLS, Auth con hook de rol, Storage) |
| Contenedores | Podman + podman-compose (imágenes OCI multi-stage) |
| CI/CD | GitHub Actions (typecheck → build → test → imágenes) |
| Monorepo | pnpm workspaces + Turborepo, tipos compartidos en `@forja/shared` |

## Estructura

```
apps/
  api/            NestJS: auth (JWT+roles), me, exercises, workouts+sync, analytics
  web/            Next.js PWA: tokens FORJA, shell responsive, SW, outbox offline
packages/
  shared/         Enums espejo de Postgres + esquemas Zod (contratos front<->back)
supabase/
  migrations/     DDL completo + RLS + hook de token + gamificación + seeds
docker-compose.yml (db autoprovisionada + api + web), infra/db-init/, .github/workflows/ci.yml, .env.example
```

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
| `pnpm test` | tests (RolesGuard, etc.) |

## Qué está implementado (mapa contra los documentos)

**Arquitectura**
- §3 Modelo de datos: migraciones con DDL íntegro, índices y **todas** las políticas RLS (incluidas las heredadas por `EXISTS` de routine_sets / workout_exercises / workout_sets).
- §5 Auth: guard JWT contra JWKS de Supabase (o HS256 legacy), claim `user_role` vía Custom Access Token Hook, `@Roles()` + RolesGuard globales, onboarding.
- §4 Contratos: `/health`, `/auth/onboarding`, `/me`, `/exercises` (con paginación keyset y escritura ADMIN), `/workouts`, **`/sync/workouts`** y `/analytics/volume`.
- §6 Offline: LWW por `client_updated_at` con upsert idempotente transaccional en el servidor; outbox Dexie + `flushOutbox()` en el cliente con compactación y triggers `online`.

**Plan de diseño**
- §3 Tokens FORJA en Tailwind v4 (dark-first + tema claro semántico), utilidades `texto-display`, `texto-dato`, `superficie`, `vidrio`.
- §5/§6 Shell responsive (tab bar translúcida móvil / sidebar desktop), pantallas Hoy·Entrenar·Progreso·Perfil según wireframes, `AnilloForja` (firma visual con ignición), chip de racha, reduced-motion global.
- §8 Recompensas server-side: PRs materializados, recálculo de stats y racha semanal, otorgamiento de medallas; el sync devuelve `rewards` para celebraciones diferidas.
- PWA: manifest + iconos (incl. maskable) + Service Worker con la política de caché del documento.

## Hecho en semanas 3–4 (esta iteración)

- `AuthGate`: guardia del shell — sin sesión → /login; sin perfil (404 de /me) → /onboarding; contexto `useMe()` para todas las pantallas.
- Onboarding de username (validación compartida con el backend vía Zod, manejo de 409).
- **Hoy** con datos reales: racha y objetivo de `GET /me`, sesiones de la semana y última sesión de `GET /workouts`, ignición del Anillo al cumplir la semana.
- **Perfil**: objetivo semanal editable (PATCH optimista con revert), toggle de perfil público, badge de rol, logout.
- **/ejercicios**: búsqueda con debounce, chips por grupo muscular, paginación keyset ("Cargar más"), detalle en sheet, y alta de ejercicios para ADMIN (403 verificado para FREE).

## Hecho en semanas 5–6 (esta iteración)

- API `routines`: listado keyset, detalle con hijos anidados, `POST`/`PUT` (reemplazo completo) transaccionales, `DELETE`, mapeo FK→400 legible.
- **Límites de plan** (tercera capa de autorización, arquitectura §5): `PLAN_LIMITS` en `@forja/shared` como fuente única — el backend lo aplica (422 en la 6ª rutina FREE, verificado E2E), el frontend solo lo muestra.
- Builder de rutinas en UI: selector de ejercicios en sheet (búsqueda + chips), series objetivo (reps/kg/RPE), reordenar, añadir/quitar series, guardar fijo inferior, edición y borrado. Reordenar es con flechas; TODO drag&drop con handle.
- Entrenar lista rutinas reales con aviso de límite; alta deshabilitada al tope.
- `docker-compose.yml` único (docker y podman) con servicio `db` que aplica stubs + migraciones al primer arranque; `.env.example` documenta los dos modos con **una sola `DATABASE_URL`**.
- Smoke E2E de rutinas: crear → listar → detalle → PUT → 422 de límite → 400 por ejercicio inexistente → DELETE.

## Siguiente en el roadmap (Fase 1)

1. Semanas 7–9: **logger de sesión activa** (SetRow, steppers, timer) escribiendo en Dexie + outbox.
2. Semanas 10–11: celebraciones (TarjetaPR, ignición) conectadas a `rewards` del sync; Background Sync; pulido PWA instalada.
3. Semanas 12–13: Progreso real (`/analytics/*`), heatmap muscular, resumen semanal.

## Notas y decisiones abiertas

- Fuentes vía `<link>` (runtime): migrar a `next/font` para eliminar el flash tipográfico (TODO perf).
- `grace_weeks` (semana de gracia de la racha) y el logro `prs_25` requieren log de eventos de PR: marcados con TODO en `workouts.service.ts`.
- Deploy: el job `image` de CI construye las imágenes; el push al registry queda pendiente de decidir hosting (pregunta abierta #3 del documento de arquitectura).
