"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { WeeklyVolumePoint } from "@forja/shared";
import { formatKg, formatKgCompact, formatWeek, niceTicks } from "@/lib/progreso/volumen";

const HEIGHT = 168;
const AXIS_W = 44; // etiquetas del eje Y ("10 mil")
const LABEL_H = 22; // etiquetas de semana bajo la base
const TOP_PAD = 8;
const MAX_BAR_W = 24; // barras delgadas: el resto del hueco es aire (dataviz §marks)
const GAP = 2;
const RADIUS = 4;

/** Columna con esquinas superiores redondeadas y base cuadrada, anclada a la linea base. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(RADIUS, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * GraficaVolumen (inventario de componentes §5): volumen por semana, una serie.
 * La semana en curso va en `--accent` plano (nunca gradiente: no es un logro);
 * las anteriores en gris recesivo. Accesible por teclado (flechas) y con tabla
 * equivalente para lectores de pantalla.
 */
export function GraficaVolumen({ points }: { points: WeeklyVolumePoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Crecimiento desde la base al montar; reduced motion lo vuelve instantaneo (globals.css).
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const ticks = niceTicks(Math.max(...points.map((p) => p.volume_kg)));
  const top = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(width - AXIS_W, 0);
  const plotH = HEIGHT - LABEL_H - TOP_PAD;
  const slot = points.length ? plotW / points.length : 0;
  const barW = Math.max(Math.min(MAX_BAR_W, slot - GAP), 2);
  const y = (v: number) => TOP_PAD + plotH - (v / top) * plotH;
  const last = points.length - 1;
  // Con 12 semanas se etiqueta una de cada 3, alineadas a la actual.
  const labelEvery = points.length > 6 ? 3 : 1;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      setActive((i) => Math.min(Math.max((i ?? last) + (i === null ? 0 : step), 0), last));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : last);
    } else if (e.key === "Escape") {
      setActive(null);
    }
  };

  const activePoint = active !== null ? points[active] : null;
  const tooltipX = active !== null ? AXIS_W + slot * active + slot / 2 : 0;

  return (
    <div className="relative">
      <div
        ref={wrapRef}
        tabIndex={0}
        role="group"
        aria-label="Gráfica de volumen semanal. Usa las flechas para recorrer las semanas."
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        className="relative rounded-[var(--radius-control)] outline-offset-4"
        style={{ height: HEIGHT }}
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} aria-hidden className="block overflow-visible">
            {/* Rejilla recesiva: hairline solida, un paso sobre la superficie */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={AXIS_W}
                  x2={width}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--border)"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={AXIS_W - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="texto-dato fill-[var(--fg-muted)] text-[11px]"
                >
                  {formatKgCompact(t)}
                </text>
              </g>
            ))}

            {points.map((p, i) => {
              const x = AXIS_W + slot * i + (slot - barW) / 2;
              const h = (p.volume_kg / top) * plotH;
              const isCurrent = i === last;
              const isActive = i === active;
              return (
                <g key={p.week_start}>
                  <path
                    d={barPath(x, y(p.volume_kg), barW, h)}
                    className="transition-[transform,fill] duration-[var(--duration-base)] ease-[var(--ease-forja)]"
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "bottom",
                      transform: grown ? "scaleY(1)" : "scaleY(0)",
                      fill: isCurrent
                        ? "var(--accent)"
                        : isActive
                          ? "var(--fg-muted)"
                          : "color-mix(in srgb, var(--fg-muted) 80%, var(--surface))",
                      filter: isCurrent && isActive ? "brightness(1.12)" : undefined,
                    }}
                  />
                  {(last - i) % labelEvery === 0 && (
                    <text
                      // La etiqueta de la semana actual se alinea al borde derecho: no se sale de la tarjeta.
                      x={isCurrent ? width : AXIS_W + slot * i + slot / 2}
                      y={HEIGHT - 6}
                      textAnchor={isCurrent ? "end" : "middle"}
                      className={`text-[11px] ${isCurrent ? "fill-[var(--fg)] font-semibold" : "fill-[var(--fg-muted)]"}`}
                    >
                      {isCurrent ? "Esta sem." : formatWeek(p.week_start)}
                    </text>
                  )}
                  {/* Zona tactil = columna completa: mas grande que la barra */}
                  <rect
                    x={AXIS_W + slot * i}
                    y={0}
                    width={slot}
                    height={HEIGHT}
                    fill="transparent"
                    onPointerEnter={() => setActive(i)}
                    onPointerDown={() => setActive(i)}
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {activePoint && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute z-10 w-max -translate-x-1/2 -translate-y-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 shadow-sm"
          style={{
            left: Math.min(Math.max(tooltipX, 72), Math.max(width - 72, 72)),
            top: y(activePoint.volume_kg) - 8, // sobre la punta de la barra
          }}
        >
          <p className="texto-dato text-sm font-bold text-[var(--fg)]">{formatKg(activePoint.volume_kg)}</p>
          <p className="text-xs text-[var(--fg-muted)]">
            {active === last ? "Esta semana" : `Semana del ${formatWeek(activePoint.week_start)}`}
            {" · "}
            {activePoint.workouts} {activePoint.workouts === 1 ? "sesión" : "sesiones"}
          </p>
        </div>
      )}

      {/* Vista de tabla: el mismo dato sin depender de la grafica */}
      {/* sr-only en un div, no en la tabla: una <table> ignora width:1px, crece a su
          contenido y provoca scroll horizontal en moviles */}
      <div className="sr-only">
        <table>
          <caption>Volumen por semana</caption>
          <thead>
            <tr>
              <th scope="col">Semana</th>
              <th scope="col">Volumen</th>
              <th scope="col">Sesiones</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={p.week_start}>
                <th scope="row">{i === last ? "Esta semana" : `Semana del ${formatWeek(p.week_start)}`}</th>
                <td>{formatKg(p.volume_kg)}</td>
                <td>{p.workouts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
