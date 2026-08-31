# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/);
el proyecto sigue [SemVer](https://semver.org/lang/es/).

## [0.1.0] — 2026-08-31

Primera versión etiquetada: **Fase 0 completa + semanas 3–11 de Fase 1**. Ya se
puede registrar un entrenamiento de principio a fin —incluso sin conexión— y
recibir las recompensas al sincronizar. Aún no es un release público: falta
Progreso (semanas 12–13) y decidir el hosting.

### Añadido

**Fundaciones**
- Monorepo pnpm + Turborepo con tipos compartidos en `@forja/shared` (enums
  espejo de Postgres + esquemas Zod como contrato único front↔back).
- Esquema completo en Supabase: 15 tablas, **25 políticas RLS**, hook
  `custom_access_token` para el claim `user_role` y seeds (15 logros, 14
  ejercicios).
- API NestJS 11 con autorización en tres capas: guard JWT (JWKS de Supabase o
  HS256 en desarrollo), `@Roles()` + RolesGuard, y ownership + límites de plan
  en servicios (`PLAN_LIMITS` como fuente única).
- PWA Next.js 15 con el sistema de diseño FORJA sobre Tailwind v4 (dark-first),
  `AnilloForja`, Service Worker (Serwist) e iconos.

**Producto**
- Onboarding de username, **Hoy** con racha y objetivo semanal reales, **Perfil**
  editable y catálogo `/ejercicios` con búsqueda, filtros y alta para ADMIN.
- **Rutinas**: CRUD completo con reemplazo transaccional y builder en UI, con el
  límite del plan FREE aplicado en el backend y mostrado en el frontend.
- **Logger de sesión activa** (semanas 7–9): pantalla completa, arranque desde
  rutina o libre, steppers de 56 px, timer de descanso, autocompletado con el
  último peso, escritura local-first en Dexie + outbox, minimizar a píldora y
  resumen final con count-up y `TarjetaPR`.
- **Sincronización offline** (semanas 10–11): `BarraSync`, celebraciones
  diferidas al reconectar (PRs, medallas y racha), Background Sync API y pulido
  de la PWA instalada.
- Recompensas calculadas **solo en el backend** (PRs, stats, racha semanal y
  medallas) y devueltas por el sync.

**Calidad y CI**
- `CI`: typecheck → build → test → imágenes OCI, corriendo también en PR.
- `ESLint` 9 (flat config) publicando hallazgos en Code scanning vía SARIF.
- Tests: Jest en la API y Vitest con `fake-indexeddb` en web, cubriendo el
  outbox sobre Dexie real (reintento, duplicado, borrado offline, compactación).

### Corregido

- **Pérdida de datos en el outbox**: la confirmación del servidor borraba las
  entradas por `workout_id`, de modo que una serie completada mientras el POST
  estaba en vuelo se eliminaba sin haberse enviado nunca. Ahora se borran solo
  los `seq` que viajaron y el workout pasa a `synced` únicamente cuando no le
  queda ninguna entrada. Hay test de regresión.
- **Doble inset del notch en la PWA instalada**: `<body>` aplicaba
  `env(safe-area-inset-top)` y se sumaba a cada contenedor `min-h-dvh`, con lo
  que la página scrolleaba un notch entero en iOS; `/sesion` además lo duplicaba.
- **CI que nunca se ejecutó**: el workflow vivía en `forja/.github/workflows/`,
  pero GitHub solo descubre workflows en la raíz del repositorio. Ningún push ni
  PR había corrido typecheck, build o tests.
- **Build de la imagen de la API**: `pnpm deploy` falla desde pnpm v10 sin
  `inject-workspace-packages=true` (`ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE`); se
  usa `--legacy`, acotado a la imagen, para no cambiar el enlazado de
  `@forja/shared` en desarrollo.
- **Workflow de ESLint**: era la plantilla de GitHub sin adaptar (apuntaba a un
  `.eslintrc.js` inexistente, corría en la raíz y ESLint no estaba adoptado);
  `continue-on-error` ocultaba el fallo real y el job moría en el upload del
  SARIF con un mensaje engañoso.
- Acciones sobre Node 20 (en deprecación) actualizadas a Node 24.

### Conocido / pendiente

- `/progreso` es todavía un placeholder; el backend solo expone
  `GET /analytics/volume`.
- Fuentes por `<link>` en vez de `next/font` (flash tipográfico).
- Reordenar ejercicios en el builder es con flechas, sin drag & drop.
- `grace_weeks` de la racha y el logro `prs_25` requieren un log de eventos de PR.
- El borrado de cuenta no elimina aún el usuario en `auth.users` (Admin API).
- El push al registry en CI está pendiente de decidir hosting.
- Las semanas 7–11 no se han re-verificado E2E contra Postgres real; las pruebas
  E2E registradas cubren hasta la semana 6.

[0.1.0]: https://github.com/MrInternauta/FORJA/releases/tag/v0.1.0
