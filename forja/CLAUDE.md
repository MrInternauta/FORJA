# CLAUDE.md — Contexto del proyecto FORJA

Este archivo da contexto a asistentes de IA (Claude Code u otros) que trabajen en este repo. Léelo completo antes de tocar código. Los documentos rectores viven en `docs/` y **mandan sobre cualquier improvisación**:

- `docs/arquitectura.md` — arquitectura técnica, modelo de datos, contratos de API, auth, estrategia offline, roadmap, riesgos.
- `docs/diseno-ui-ux.md` — sistema de diseño FORJA: tokens, tipografía, wireframes, animaciones, gamificación.
- `docs/ESTADO.md` — qué está hecho, qué está verificado E2E y cuál es la siguiente tarea.

## Qué es

PWA de registro y seguimiento de entrenamientos (equivalente funcional de Hevy) con capa social (Fase 2) y premium con IA (Fase 3). Contexto de negocio confirmado: ~20k registrados / ~2k DAU al año 1, **1 dev solo founder**, MVP 12–16 semanas, infra $50–200 USD/mes, LATAM (es-MX), unidades en kg.

## Stack (restricciones NO negociables)

- Monorepo pnpm workspaces + Turborepo. Tipos compartidos en `packages/shared` (`@forja/shared`).
- Backend: **NestJS 11** (`apps/api`), CommonJS, `pg` directo (sin ORM), validación con Zod compartida.
- Frontend: **Next.js 15 App Router** como PWA (`apps/web`), **Tailwind CSS v4** (config CSS-first en `app/globals.css`), Serwist (SW), Dexie (IndexedDB), next-themes.
- Datos/Auth/Storage: **Supabase** (Postgres con RLS, Auth con Custom Access Token Hook, Storage).
- Contenedores: imágenes OCI (Podman/Docker), `docker-compose.yml` único.
- CI/CD: GitHub Actions (`.github/workflows/ci.yml`): typecheck → build → test → imágenes.

## Arquitectura en una frase

El cliente habla con Supabase SOLO para auth y media; **todo dato de negocio pasa por NestJS**, que aplica autorización en 3 capas: (1) AuthGuard JWT (JWKS de Supabase, o HS256 con `SUPABASE_JWT_SECRET` en dev), (2) `@Roles()` + RolesGuard con el claim `user_role`, (3) ownership + límites de plan en servicios (`PLAN_LIMITS` de `@forja/shared` es la fuente única). RLS queda activa como red de seguridad.

## Convenciones que NO se rompen

1. **Zod compartido**: todo payload de API tiene su esquema en `packages/shared/src/schemas/`; el controller usa `zodParse()` (`apps/api/src/common/zod.ts`); el frontend valida con el mismo esquema antes de enviar.
2. **Enums espejo**: los enums TS de `shared/src/enums.ts` replican EXACTAMENTE los enums de Postgres (migraciones). Si cambias uno, cambia el otro en el mismo commit.
3. **IDs de cliente + LWW**: `workouts`, `workout_exercises` y `workout_sets` usan uuid v4 generados por el CLIENTE (sync offline idempotente). Conflictos: Last-Write-Wins por `client_updated_at` a nivel documento-workout; el servidor responde `applied | skipped_stale | error` por ítem.
4. **Recompensas solo en backend**: PRs, stats, racha semanal y medallas se calculan en `apps/api/src/workouts/workouts.service.ts` al confirmar el sync, NUNCA en el cliente. La respuesta del sync incluye `rewards` para celebraciones diferidas.
5. **Tokens semánticos**: los componentes web consumen SOLO `--bg`, `--surface`, `--border`, `--fg`, `--fg-muted`, `--accent` (definidos en `globals.css`); nunca hexes directos. Dark es el tema por defecto.
6. **Regla de oro (literal)**: el gradiente oro→brasa aparece ÚNICAMENTE en momentos de logro (ignición del `AnilloForja`, PR, racha). En todo lo demás, `--accent` plano. Un solo dato display XXL por pantalla.
7. **Copy sin culpa** (gamificación §8.2): sin lenguaje punitivo, sin FOMO, recompensas ligadas a esfuerzo real. Racha SEMANAL (no diaria): el descanso es parte del entrenamiento.
8. **Accesibilidad**: objetivos táctiles ≥44px (56px en sesión activa), contraste AA, `prefers-reduced-motion` elimina movimiento pero conserva la recompensa de color, focos visibles.
9. **Errores legibles**: mapear errores de BD a HTTP con mensaje en español (ej. FK 23503 → 400 "no existe en el catálogo"). Nada de 500 opacos por casos esperables.
10. **Migraciones**: solo en `supabase/migrations/` con prefijo numérico; toda tabla nueva lleva RLS en la misma migración.

## Comandos

```bash
pnpm install          # deps
pnpm dev              # web :3000 + api :3001 (prefijo /v1) en watch
pnpm build            # shared -> api -> web (turbo)
pnpm typecheck        # TS estricto en los 3 paquetes
pnpm test             # jest (api)
docker compose up db  # SOLO Postgres con migraciones auto-aplicadas (modo B)
supabase start        # stack Supabase completo (modo A)
```

Base de datos: los dos modos exponen Postgres en `127.0.0.1:54322` ⇒ una sola `DATABASE_URL` en `.env` (ver `.env.example`). En modo B no hay Supabase Auth: define `SUPABASE_JWT_SECRET` y firma tokens HS256 de prueba (`sub` = uuid insertado en `auth.users`, claim `user_role`).

## Estado actual y siguiente tarea

Ver `docs/ESTADO.md`. Resumen: Fase 0 + semanas 3–6 de Fase 1 hechas y verificadas E2E. **La siguiente tarea es el logger de sesión activa (semanas 7–9)** — la pantalla más importante del producto: pantalla completa sin navegación, `SetRow` con steppers de 56px, timer de descanso, autocompletado con el último peso, escritura local-first en Dexie + outbox, "empezar desde rutina" (el backend ya está listo: `GET /routines/:id` para precargar y `POST /sync/workouts` para persistir).
