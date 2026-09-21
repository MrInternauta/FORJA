# Plan de diseño UI/UX y maquetación — PWA de entrenamientos

Complemento del documento de arquitectura. Define dirección visual, tokens, sistema de componentes, maquetación responsive, animaciones y sistema de recompensas. Objetivo emocional del brief: **elegante, fuerte, aspiracional, competitivo**, con recompensas al estilo Duolingo adaptadas al fitness.

---

## 1. Dirección de diseño: «FORJA»

**Concepto.** El levantamiento es forjar metal: hierro, calor, repetición, resultado. La app no es un cuaderno de notas ni un juguete de colores; es el taller donde el usuario se construye. Todo el lenguaje visual deriva de ahí: superficies de carbón y acero, un único acento de **oro fundido** reservado para el logro, y números grandes tratados como material protagonista.

**Personalidad traducida a decisiones:**

| Atributo del brief | Decisión de diseño |
|---|---|
| Elegante | Paleta contenida (2 neutros + 1 acento), mucho espacio negativo, jerarquía tipográfica estricta, cero decoración gratuita |
| Fuerte | Display condensado en mayúsculas para títulos y números de carga; contraste alto; bordes definidos, no blandos |
| Aspiracional | El oro solo aparece cuando se gana: PRs, medallas, racha. La UI "se enciende" con el mérito, no por defecto |
| Competitivo | Comparación contra tu yo anterior en el MVP (PRs, volumen vs. semana pasada); ligas entre seguidos en Fase 2 |

**Firma visual: el Anillo de Forja.** Un anillo de progreso metálico presente en la sesión activa y en el resumen semanal. Se llena set a set con un trazo de acero; al completar el objetivo o romper un PR, el trazo funde a gradiente oro→brasa con una micro-animación de "ignición". Es el único elemento con gradiente de toda la interfaz: por eso se recuerda.

**Anti-patrón deliberado:** se evita el look genérico de app de gym (negro + verde ácido + foto de stock de mancuernas) y el confeti multicolor tipo juego infantil. La recompensa aquí es metal, no caramelo.

---

## 2. Tendencias UI/UX 2026 aplicadas (y cuáles se descartan)

Basado en análisis de tendencias publicados para 2026 (Figma, Tubik Studio, Lyssna, UX Collective, Orizon, Envato). No se adopta ninguna por moda: cada una debe servir al estilo FORJA.

| Tendencia 2026 | Cómo se aplica aquí |
|---|---|
| **Motion con propósito** (la animación comunica estado y estructura, no decora; retorno de micro-interacciones bien medidas) | Catálogo de animaciones de §7: cada una tiene un mensaje (progreso, confirmación, logro). Nada se mueve "porque sí" |
| **Reduced motion como estándar de accesibilidad** | Todas las animaciones respetan `prefers-reduced-motion`; las celebraciones tienen variante estática (§7) |
| **Tipografía expresiva / oversized como protagonista** | El peso levantado y el timer se muestran en display XXL: el dato ES el hero de la pantalla de sesión |
| **Tipografía mono-inspirada para datos** | Numerales tabulares/mono en pesos, reps, timers y tablas: alineación perfecta y lectura "de instrumento" |
| **Interfaces calmadas / reducción de carga cognitiva** (menos teatro visual, menos decisiones por sesión) | En sesión activa solo existe una decisión: la siguiente serie. Autocompletado con el último peso usado, un tap para confirmar |
| **Dopamine design / color saturado** | Adoptada **solo** en el momento de recompensa (oro/brasa). El resto de la UI permanece sobria: contraste entre calma y celebración es lo que hace sentir la recompensa |
| **Profundidad y materiales adaptativos (liquid-glass, capas translúcidas)** | Uso puntual: barra de navegación y sheets con blur translúcido sobre el contenido. No se aplica a tarjetas de datos (legibilidad primero) |
| **Gamificación ruidosa → micro-interacciones calmadas** | La capa de recompensas (§8) sigue mecánicas Duolingo pero con estética contenida y sin dark patterns (sin culpa, sin FOMO artificial) |
| Descartadas: 3D/WebGL inmersivo, cursores creativos, AI generativa de UI | Costo alto para un solo dev, cero aporte al caso de uso "registrar una serie con las manos sudadas en 3 segundos" |

---

## 3. Design tokens

### 3.1 Paleta

**Modo oscuro (por defecto — es una app que se usa en gimnasios, a menudo con poca luz, y el negro carbón refuerza FORJA):**

| Token | Hex | Uso |
|---|---|---|
| `carbon` | `#0C0E12` | Fondo base |
| `acero` | `#161A21` | Superficies (cards, sheets) |
| `linea` | `#262C36` | Bordes, divisores |
| `humo` | `#8B93A1` | Texto secundario, labels |
| `hueso` | `#F1EFE9` | Texto principal |
| `oro` | `#E3A43B` | Acento: acciones primarias, logros |
| `brasa` | `#E05A2B` | Extremo del gradiente de ignición (PR, racha) |
| `senal` | `#41B883` | Éxito funcional (sync ok, set completado) — uso mínimo |
| `alerta` | `#E0564B` | Errores |

**Modo claro** (mismos roles semánticos, valores propios — no una inversión automática):

| Token | Hex | Uso |
|---|---|---|
| `fondo` | `#F6F4EF` | Fondo base (porcelana cálida, no blanco puro) |
| `superficie` | `#FFFFFF` | Cards |
| `linea` | `#E3DFD6` | Bordes |
| `texto-sec` | `#6B7280` | Secundario |
| `texto` | `#15181E` | Principal |
| `oro` | `#966418` | Acento oscurecido: AA como texto sobre porcelana (4.6:1) y bajo texto blanco (5.1:1). El `#B0761C` original solo daba 3.85:1 (AA grande) |
| `brasa` | `#C2431C` | Ídem |

Regla de oro (literal): el gradiente `oro → brasa` está prohibido fuera de los momentos de logro. Botones primarios usan `oro` plano.

### 3.2 Tipografía

| Rol | Fuente | Uso |
|---|---|---|
| Display | **Archivo** (variable, Expanded + Black, mayúsculas, tracking apretado) | Títulos de pantalla, números hero (peso, timer, PR), medallas |
| Cuerpo | **Instrument Sans** | Todo el texto de UI |
| Datos | **JetBrains Mono** (o numerales tabulares de Archivo si el peso de bundle aprieta) | Pesos, reps, tiempos, tablas de historial |

Escala: `12 / 14 / 16 / 20 / 28 / 40 / 64`. El tamaño 64 (display) existe solo para el dato protagonista de cada pantalla — uno por pantalla, máximo.

### 3.3 Tokens en Tailwind v4 (CSS-first)

```css
/* apps/web/app/globals.css */
@import "tailwindcss";

@theme {
  --color-carbon: #0c0e12;
  --color-acero: #161a21;
  --color-linea: #262c36;
  --color-humo: #8b93a1;
  --color-hueso: #f1efe9;
  --color-oro: #e3a43b;
  --color-brasa: #e05a2b;
  --color-senal: #41b883;
  --font-display: "Archivo", sans-serif;
  --font-sans: "Instrument Sans", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --radius-card: 1rem;
  --radius-control: 0.625rem;
  --ease-forja: cubic-bezier(0.2, 0.8, 0.2, 1);
  --duration-fast: 150ms;
  --duration-base: 250ms;
  --duration-celebracion: 900ms;
}

/* Tokens semánticos que cambian por tema (consumidos vía bg-[var(--surface)] o utilidades propias) */
:root {
  --bg: var(--color-carbon);
  --surface: var(--color-acero);
  --border: var(--color-linea);
  --fg: var(--color-hueso);
  --fg-muted: var(--color-humo);
  --accent: var(--color-oro);
}
.light {
  --bg: #f6f4ef;
  --surface: #ffffff;
  --border: #e3dfd6;
  --fg: #15181e;
  --fg-muted: #6b7280;
  --accent: #966418;
}
```

Los componentes consumen **solo tokens semánticos** (`--bg`, `--surface`, `--fg`, `--accent`); nunca hexes directos. Así el theming es un problema resuelto una vez.

### 3.4 Radios, sombras, densidad

- Radios: `--radius-card` en tarjetas, `--radius-control` en inputs/botones. Sin `rounded-full` salvo avatares y el Anillo de Forja.
- Sombras: casi ausentes en dark (la jerarquía la dan superficie + borde); en light, una sola sombra suave para cards elevadas.
- Densidad táctil: todo objetivo táctil ≥ 44×44 px. En sesión activa, los controles de peso/reps suben a 56 px: se opera con guantes, sudor y prisa.

---

## 4. Modo oscuro / claro

- **Dark-first.** Se diseña primero el oscuro (contexto real de uso) y el claro se deriva de los tokens semánticos.
- Implementación: `next-themes` con `attribute="class"` (clase `.light`), default `dark`, opción "sistema". Sin flash de tema incorrecto: script inline en `<head>` (lo gestiona la librería) + `color-scheme` en CSS.
- `theme-color` del manifest y de la meta tag sincronizados por tema para que la barra del sistema acompañe (instalada como PWA se nota mucho).
- Las imágenes/medias del catálogo se muestran sobre `--surface` con un scrim sutil en dark para que fotos claras no "quemen" la pantalla.
- Criterio de contraste: AA mínimo en todo texto; el `oro` claro (`#966418`) existe precisamente porque `#E3A43B` no pasa AA sobre fondo porcelana. Los colores de estado tienen su versión clara (`--positive`, `--danger`, `--warning`) y el gradiente de ignición también (`--ignicion-desde/hasta`), todos ≥4.5:1.

---

## 5. Stack y sistema de componentes

| Pieza | Elección | Razón |
|---|---|---|
| Estilos | **Tailwind CSS v4** | Restricción del brief; config CSS-first = tokens en un solo lugar |
| Primitivas UI | **shadcn/ui** (Radix) re-tokenizada con FORJA | Accesibilidad resuelta (focus, teclado, aria) sin costo para un solo dev |
| Animación | **Motion** (motion.dev) + transiciones CSS | Springs y orquestación para las celebraciones; CSS para lo simple |
| Tema | **next-themes** | Estándar de facto |
| Iconos | **Lucide** en trazo 1.75px | Coherente con el trazo del Anillo |
| Gráficas | **Recharts** re-tokenizada | Ya prevista en arquitectura |

**Inventario de componentes propios** (sobre las primitivas):

- `AnilloForja` — anillo de progreso SVG con estados: neutro → completando → ignición (firma visual).
- `SetRow` — fila de serie: peso · reps · RPE · check. El componente más usado de la app; se diseña y prueba primero.
- `StepperPeso` / `StepperReps` — steppers grandes (±2.5 kg / ±1 rep) con press-and-hold acelerado.
- `TimerDescanso` — cuenta regresiva display XXL, editable con un tap, notificación local al terminar.
- `TarjetaPR` — celebración de récord (§7/§8), exportable como imagen para compartir.
- `MedallaLogro` — medalla con tier de metal (hierro/bronce/plata/oro/platino).
- `RachaSemanal` — indicador de racha con las semanas cumplidas.
- `BarraSync` — estado offline/sincronizando/al día, discreta, nunca modal.
- `TarjetaEjercicio`, `TarjetaRutina`, `PostEntrenamiento` (Fase 2), `GraficaVolumen`, `HeatmapMuscular`.

---

## 6. Maquetación y navegación responsive

### 6.1 Breakpoints y estrategia

Mobile-first estricto: >90 % del uso real ocurre en el teléfono dentro del gimnasio.

| Rango | Layout |
|---|---|
| `< 768px` (base) | Una columna; **bottom tab bar** translúcida (blur) de 4 pestañas: Hoy · Entrenar · Progreso · Perfil (+ Feed en Fase 2, reordenando a 5) |
| `md ≥ 768px` | Contenido a 640px centrado; tab bar persiste |
| `lg ≥ 1024px` | **Sidebar** izquierda fija (mismas secciones), contenido máx. 960px; Progreso pasa a grid de 2 columnas |

La sesión activa es la excepción: ocupa pantalla completa en todos los tamaños, sin navegación visible (salir requiere acción explícita: minimizar a píldora flotante o finalizar). Nada compite con el entrenamiento.

### 6.2 Pantallas clave (wireframes)

**Hoy (dashboard / home):**

```
┌──────────────────────────────┐
│ MIÉRCOLES 15 JUL      [🔥 6] │  ← racha semanal, arriba der.
│                              │
│ ┌──────────────────────────┐ │
│ │  ANILLO FORJA  ◐  3/4    │ │  ← objetivo semanal de sesiones
│ │  "1 sesión para cerrar   │ │
│ │   la semana"             │ │
│ └──────────────────────────┘ │
│                              │
│ ▶ EMPEZAR: Torso — Empuje    │  ← CTA oro: siguiente rutina sugerida
│   o entrenamiento libre      │
│                              │
│ ÚLTIMA SESIÓN                │
│ ┌──────────────────────────┐ │
│ │ Lun · Pierna · 52 min    │ │
│ │ 8,420 kg · 1 PR 🥇       │ │
│ └──────────────────────────┘ │
│                              │
│ [Hoy] [Entrenar] [Prog] [Yo] │
└──────────────────────────────┘
```

**Sesión activa (la pantalla más importante del producto):**

```
┌──────────────────────────────┐
│ ✕ min.        47:12    ⏱1:30 │  ← duración | descanso activo
│                              │
│ PRESS BANCA          serie 3 │
│                              │
│        82.5 kg               │  ← display XXL mono, dato hero
│      [−]      [+]            │  ← steppers 56px
│        8 reps   RPE 8        │
│                              │
│  ┌────────────────────────┐  │
│  │ ✓ 80 × 8    ✓ 82.5 × 8 │  │  ← series hechas, compactas
│  └────────────────────────┘  │
│                              │
│ ██████ COMPLETAR SERIE █████ │  ← botón gigante, pulgar
│                              │
│ Siguiente: Press inclinado → │
└──────────────────────────────┘
```

**Progreso:**

```
┌──────────────────────────────┐
│ PROGRESO        [4s] [12s] ▾ │
│                              │
│ VOLUMEN SEMANAL              │
│ ▂▄▅▃▆▇█  ↑12% vs sem. pasada │  ← comparación competitiva contra ti
│                              │
│ POR GRUPO MUSCULAR   POR MÁQ.│
│ [heatmap corporal]  [barras] │
│                              │
│ RÉCORDS PERSONALES           │
│ 🥇 Sentadilla 140kg  hace 3d │
│ 🥇 Press banca 85kg  hace 9d │
│                              │
│ VITRINA DE MEDALLAS  (12/40) │
│ ◈ ◈ ◈ ◇ ◇ ◇ …                │
└──────────────────────────────┘
```

**Catálogo / selector de ejercicio:** buscador arriba, chips de filtro (grupo muscular, equipamiento), lista virtualizada de `TarjetaEjercicio` (thumbnail + nombre + grupo), detalle en sheet con media demostrativa y el historial personal de ese ejercicio debajo (dato > marketing).

**Builder de rutina:** lista reordenable por arrastre (drag handle), cada ejercicio expande sus series objetivo; botón fijo inferior "Guardar rutina".

### 6.3 Reglas de maquetación

- Un dato hero por pantalla (display XXL); todo lo demás baja dos escalones de jerarquía.
- Estados vacíos siempre accionables ("Aún no hay entrenamientos. ▶ Empieza el primero").
- Esqueletos (skeleton) con shimmer sutil en cargas de red; nunca spinners a pantalla completa.
- Safe areas iOS/Android respetadas (`env(safe-area-inset-*)`) — crítico en PWA instalada.

---

## 7. Sistema de animaciones

Principio (alineado a la tendencia 2026 de motion con propósito): **cada animación comunica una de tres cosas — progreso, confirmación o logro.** Si no comunica ninguna, se corta.

| Momento | Animación | Duración / física | Mensaje |
|---|---|---|---|
| Completar serie | Check con spring corto + fila colapsa a compacta; tick háptico | 150–250 ms, spring rígido | Confirmación instantánea |
| Avance del Anillo | Trazo crece con ease `--ease-forja` | 400 ms | Progreso |
| **PR (firma)** | El Anillo/valor "igniciona": el trazo funde de acero a gradiente oro→brasa con 6–8 partículas ascendentes tipo chispa de fragua + haptic fuerte + `TarjetaPR` | 900 ms, una sola vez, no en loop | Logro — el único momento maximalista de la app |
| Fin de entrenamiento | Count-up de totales (volumen, duración, PRs) en secuencia escalonada | 200 ms/valor | Recompensa de cierre |
| Racha cumplida | El número de racha late una vez y suma +1 | 400 ms | Logro |
| Navegación entre tabs | Cross-fade + slide 8px | 150 ms | Orientación |
| Sheets/modales | Slide-up con blur del fondo | 250 ms | Jerarquía espacial |
| Timer de descanso llega a 0 | Pulso del display + notificación | 3 pulsos | Estado del sistema |

Reglas duras:

- `prefers-reduced-motion: reduce` → se eliminan springs, partículas y count-ups; las celebraciones se sustituyen por el cambio de color estático a oro (la recompensa visual se conserva, el movimiento no).
- Nada anima en loop infinito salvo el timer de descanso (pulso final).
- Presupuesto de rendimiento: solo `transform` y `opacity`; las chispas del PR son un canvas ligero o SVG animado, jamás una librería de confeti pesada.

---

## 8. Sistema de recompensas (gamificación estilo Duolingo, adaptada)

Duolingo funciona por: racha + recompensa inmediata + progresión visible + competición ligera. Se adopta la mecánica, **no la estética** (aquí el premio es metal forjado, no gemas). Y con un ajuste clave de dominio: en fitness la constancia diaria estricta es contraproducente (el descanso es parte del entrenamiento), así que la racha es **semanal**, no diaria.

### 8.1 Mecánicas por fase

| Mecánica | Cómo funciona | Fase |
|---|---|---|
| **Racha semanal 🔥** | El usuario fija su objetivo (2–6 sesiones/semana). Cumplirlo mantiene la racha. 1 "semana de gracia" ganada cada 4 semanas cumplidas (equivalente al streak freeze, pero ganada, no comprada) | MVP |
| **Recompensa inmediata por serie** | Check + háptico + el Anillo avanza. Micro-dopamina en la acción atómica del producto | MVP |
| **PRs con ignición** | Detección automática de récord (mejor peso×reps y 1RM estimado por ejercicio) → celebración §7 + `TarjetaPR` compartible | MVP |
| **Medallas de metal** | Logros por hitos con tiers hierro→bronce→plata→oro→platino: volumen acumulado, sesiones totales, rachas, PRs por grupo muscular. Vitrina en Progreso con medallas bloqueadas visibles en silueta (aspiracional: se ve lo que falta) | MVP (set inicial ~15 logros) |
| **Resumen semanal** | Cada lunes: volumen vs. semana anterior, racha, medallas nuevas. Competencia contra tu yo pasado | MVP |
| **Ligas entre seguidos** | Ranking semanal por *sesiones completadas* (no por kg absolutos: no es justo ni sano comparar cargas entre cuerpos distintos) entre la gente que sigues. Podio con estética de medallero | Fase 2 |
| **Retos PRO** | Retos mensuales generados por IA según historial (p. ej. "+5 % de volumen en espalda este mes") con medalla exclusiva | Fase 3 |

### 8.2 Ética de la recompensa (tendencia 2026: sin dark patterns)

- **Sin culpa:** perder la racha nunca usa lenguaje punitivo ni notificaciones de ansiedad. Copy: "Nueva semana, nueva forja", no "¡Vas a perder tu racha!".
- **Sin FOMO artificial:** nada de contadores regresivos para comprar ni recompensas que expiran por no abrir la app.
- **Recompensa ligada a esfuerzo real,** nunca a engagement vacío (no hay XP por abrir la app o ver el feed).
- Notificaciones: máximo 1/día, todas desactivables por tipo, y solo de tres clases: recordatorio de sesión planificada, fin de descanso, resumen semanal.

### 8.3 Delta al modelo de datos (se añade a las migraciones del doc de arquitectura)

```sql
create table public.user_stats (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  weekly_goal        smallint not null default 3 check (weekly_goal between 1 and 7),
  current_streak     int not null default 0,   -- semanas
  longest_streak     int not null default 0,
  grace_weeks        smallint not null default 0,
  total_volume_kg    numeric(12,2) not null default 0,
  total_workouts     int not null default 0,
  updated_at         timestamptz not null default now()
);

create table public.achievements (
  id          text primary key,          -- slug: 'volumen_100k', 'racha_12'
  name        text not null,
  description text not null,
  tier        text not null check (tier in ('hierro','bronce','plata','oro','platino')),
  sort_order  smallint not null
);

create table public.user_achievements (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id),
  earned_at      timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
-- RLS: user_stats y user_achievements legibles por el dueño (y públicas si profile.is_public,
-- para la vitrina en perfiles públicos de Fase 2); escritura solo por backend.
```

Los cálculos de racha, PRs y logros se ejecutan en NestJS al confirmar el sync de un workout (no en el cliente): una sola fuente de verdad, resistente a relojes de cliente. El endpoint de sync ya existente responde además `{ rewards: { new_prs: [...], new_achievements: [...], streak_delta } }` para que la UI dispare las celebraciones al reconectar (si entrenaste offline, la ignición te espera al sincronizar — la recompensa nunca se pierde).

---

## 9. Plan de implementación de la maqueta (encaje en el roadmap)

Se integra en las semanas ya planificadas para 1 dev; el trabajo de diseño no añade fases, disciplina el orden:

| Semana(s) | Entregable de diseño/UI |
|---|---|
| 1–2 (Fase 0) | Tokens FORJA en Tailwind v4, dark/light con next-themes, shadcn re-tokenizado, tipografías cargadas (subset + `font-display: swap`), layout base con tab bar/sidebar responsive |
| 3–4 | Catálogo + perfil con `TarjetaEjercicio`, chips de filtro, sheet de detalle; estados vacíos y skeletons del sistema |
| 5–6 | Builder de rutina (drag reordenable), `TarjetaRutina` |
| 7–9 | **Sesión activa**: `SetRow`, steppers, `TimerDescanso`, `AnilloForja` con ignición, detección de PR + `TarjetaPR`. Aquí vive el 60 % del valor percibido: se le dedica el bloque más largo |
| 10–11 | `BarraSync` + celebraciones diferidas post-sync; pulido PWA instalada (safe areas, theme-color, splash) |
| 12–13 | Progreso: gráficas re-tokenizadas, heatmap muscular, vitrina de medallas, resumen semanal; pase completo de accesibilidad (contraste AA, foco visible, reduced motion) y QA responsive en 320px–1440px |

**Criterio de "listo" del diseño:** un usuario registra una serie en ≤ 2 taps desde la pantalla de sesión; Lighthouse accesibilidad ≥ 95; la app es reconocible en un screenshot sin logo (la firma FORJA se sostiene sola); las tres celebraciones (serie, PR, racha) funcionan también tras entrenar offline.
