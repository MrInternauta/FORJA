"use client";

import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import type { DistributionPoint, MuscleGroup } from "@forja/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { MUSCLE_LABELS } from "@/lib/labels";
import { heatLegend, heatStep, rangeStart } from "@/lib/progreso/heatmap";
import { formatKg, type RangoSemanas } from "@/lib/progreso/volumen";

type Estado = { fase: "cargando" } | { fase: "error" } | { fase: "listo"; points: DistributionPoint[] };

/** Figura geometrica (viewBox 100x200): rombos y bloques, no anatomia fotografica. */
type Forma =
  | { kind: "rect"; x: number; y: number; w: number; h: number; r: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "path"; d: string };

const rect = (x: number, y: number, w: number, h: number, r: number): Forma => ({ kind: "rect", x, y, w, h, r });
const par = (x: number, y: number, w: number, h: number, r: number): Forma[] => [
  rect(x, y, w, h, r),
  rect(100 - x - w, y, w, h, r), // espejo
];
const hombros: Forma[] = [
  { kind: "ellipse", cx: 29, cy: 37, rx: 6.5, ry: 7 },
  { kind: "ellipse", cx: 71, cy: 37, rx: 6.5, ry: 7 },
];

/** Regiones por vista. Separadas >=2 unidades: el hueco de superficie separa, no un trazo. */
const FRENTE: [MuscleGroup, Forma[]][] = [
  ["shoulders", hombros],
  ["chest", par(38, 31, 11, 17, 4)],
  ["biceps", par(21, 46, 9, 21, 4.5)],
  ["forearms", par(18, 69, 9, 25, 4.5)],
  ["core", [rect(39, 51, 22, 34, 5)]],
  ["quads", par(37, 101, 12, 46, 6)],
  ["calves", par(38, 151, 10, 38, 5)],
];
const ESPALDA: [MuscleGroup, Forma[]][] = [
  ["shoulders", hombros],
  ["back", [{ kind: "path", d: "M38,30 H62 L64,52 L58,84 H42 L36,52 Z" }]],
  ["triceps", par(21, 46, 9, 21, 4.5)],
  ["forearms", par(18, 69, 9, 25, 4.5)],
  ["glutes", par(38, 88, 11, 15, 5)],
  ["hamstrings", par(37, 106, 12, 41, 6)],
  ["calves", par(38, 151, 10, 38, 5)],
];
/** Cabeza, cuello, pelvis: estructura, no dato. */
const NEUTRAS: Record<"frente" | "espalda", Forma[]> = {
  frente: [{ kind: "ellipse", cx: 50, cy: 14, rx: 9, ry: 9 }, rect(46, 22, 8, 6, 2), rect(39, 88, 22, 10, 4)],
  espalda: [{ kind: "ellipse", cx: 50, cy: 14, rx: 9, ry: 9 }, rect(46, 22, 8, 6, 2)],
};

/** Orden de recorrido con flechas: de arriba abajo, frente y luego espalda. */
const EN_CUERPO: MuscleGroup[] = [
  "shoulders", "chest", "biceps", "forearms", "core", "quads", "calves",
  "back", "triceps", "glutes", "hamstrings",
];
/** Sin region en la figura: van como chips debajo. */
const FUERA_DEL_CUERPO: MuscleGroup[] = ["full_body", "cardio"];

function fillFor(step: number): string {
  return step === 0 ? "var(--bg)" : `var(--heat-${step})`;
}

function Pieza({ forma, ...props }: { forma: Forma } & React.SVGProps<SVGElement>) {
  const p = props as React.SVGProps<never>;
  switch (forma.kind) {
    case "rect":
      return <rect x={forma.x} y={forma.y} width={forma.w} height={forma.h} rx={forma.r} {...p} />;
    case "ellipse":
      return <ellipse cx={forma.cx} cy={forma.cy} rx={forma.rx} ry={forma.ry} {...p} />;
    case "path":
      return <path d={forma.d} {...p} />;
  }
}

function Figura({
  vista,
  regiones,
  stepOf,
  activa,
  onSelect,
}: {
  vista: "frente" | "espalda";
  regiones: [MuscleGroup, Forma[]][];
  stepOf: (g: MuscleGroup) => number;
  activa: MuscleGroup | null;
  onSelect: (g: MuscleGroup) => void;
}) {
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox="-2 -2 104 194" className="h-auto w-full max-w-[150px]" aria-hidden>
        {NEUTRAS[vista].map((f, i) => (
          <Pieza key={i} forma={f} fill="var(--border)" />
        ))}
        {regiones.map(([grupo, formas]) => {
          const step = stepOf(grupo);
          const seleccionada = grupo === activa;
          return formas.map((f, i) => (
            <Pieza
              key={`${grupo}-${i}`}
              forma={f}
              fill={fillFor(step)}
              stroke={
                seleccionada
                  ? "var(--fg)"
                  : step === 0
                    ? "color-mix(in srgb, var(--fg-muted) 80%, var(--surface))"
                    : "none"
              }
              strokeWidth={seleccionada ? 1.75 : 1}
              className="cursor-pointer transition-[fill] duration-[var(--duration-base)]"
              onPointerEnter={() => onSelect(grupo)}
              onPointerDown={() => onSelect(grupo)}
            />
          ));
        })}
      </svg>
      <figcaption className="text-xs text-[var(--fg-muted)]">{vista === "frente" ? "Frente" : "Espalda"}</figcaption>
    </figure>
  );
}

function Swatch({ step }: { step: number }): ReactNode {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 rounded-[3px]"
      style={{
        background: fillFor(step),
        border: step === 0 ? "1px solid color-mix(in srgb, var(--fg-muted) 80%, var(--surface))" : undefined,
      }}
    />
  );
}

/**
 * HeatmapMuscular (§5, wireframe §6.2 "por grupo muscular"): series completadas
 * por grupo PRIMARIO de cada ejercicio en el rango de la pantalla. Se mide en
 * series y no en kg: los ejercicios con peso corporal registran 0 kg y
 * apareceria como no entrenado. Rampa de un tono (`--heat-1..4`) relativa al grupo
 * mas trabajado. Datos de `GET /analytics/distribution?by=muscle_group`.
 */
export function HeatmapMuscular({ weeks }: { weeks: RangoSemanas }) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);
  const [activa, setActiva] = useState<MuscleGroup | null>(null);
  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vigente = true;
    setEstado({ fase: "cargando" });
    const from = encodeURIComponent(rangeStart(weeks));
    api<DistributionPoint[]>(`/analytics/distribution?by=muscle_group&from=${from}`)
      .then((points) => {
        if (!vigente) return;
        setEstado({ fase: "listo", points });
        // Abre en el grupo mas trabajado (la API ordena por volumen; aqui importan las series).
        const top = [...points].sort((a, b) => b.sets - a.sets)[0];
        setActiva((top?.key as MuscleGroup | undefined) ?? null);
      })
      .catch(() => vigente && setEstado({ fase: "error" }));
    return () => {
      vigente = false;
    };
  }, [weeks, intento]);

  const points = estado.fase === "listo" ? estado.points : [];
  const byGroup = new Map(points.map((p) => [p.key as MuscleGroup, p]));
  const max = Math.max(0, ...points.map((p) => p.sets));
  const stepOf = (g: MuscleGroup) => heatStep(byGroup.get(g)?.sets ?? 0, max);
  const detalle = activa ? byGroup.get(activa) : undefined;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = activa ? EN_CUERPO.indexOf(activa) : -1;
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = i === -1 ? 0 : (i + step + EN_CUERPO.length) % EN_CUERPO.length;
    setActiva(EN_CUERPO[next]);
  };

  return (
    <Card>
      <div className="mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
          Por grupo muscular
        </h2>
        <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
          Series completadas · últimas {weeks} semanas
        </p>
      </div>

      {estado.fase === "cargando" && (
        <div aria-busy="true" aria-label="Cargando grupos musculares" className="flex justify-center gap-6 py-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-[180px] w-[110px] animate-pulse rounded-[var(--radius-control)] bg-[var(--border)]" />
          ))}
        </div>
      )}

      {estado.fase === "error" && (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-[var(--fg-muted)]">
            No pudimos cargar tus grupos musculares. Tus series están a salvo; se muestran al volver la conexión.
          </p>
          <Button variant="ghost" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      )}

      {estado.fase === "listo" && (
        <>
          <div
            tabIndex={0}
            role="group"
            aria-label="Mapa de grupos musculares. Usa las flechas para recorrerlos."
            onKeyDown={onKeyDown}
            className="grid grid-cols-2 gap-2 rounded-[var(--radius-control)] outline-offset-4"
          >
            <Figura vista="frente" regiones={FRENTE} stepOf={stepOf} activa={activa} onSelect={setActiva} />
            <Figura vista="espalda" regiones={ESPALDA} stepOf={stepOf} activa={activa} onSelect={setActiva} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {FUERA_DEL_CUERPO.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={activa === g}
                onClick={() => setActiva(g)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border px-3 text-sm ${
                  activa === g ? "border-[var(--fg-muted)] text-[var(--fg)]" : "border-[var(--border)] text-[var(--fg-muted)]"
                }`}
              >
                <Swatch step={stepOf(g)} />
                {MUSCLE_LABELS[g]}
              </button>
            ))}
          </div>

          {/* Sin datos no hay grupo abierto: sin linea vacia que deje hueco */}
          <p aria-live="polite" className={`text-sm text-[var(--fg)] ${activa ? "mt-3 min-h-5" : ""}`}>
            {activa &&
              (detalle ? (
                <>
                  <span className="font-semibold">{MUSCLE_LABELS[activa]}</span>
                  <span className="texto-dato text-[var(--fg-muted)]">
                    {" · "}
                    {detalle.sets} {detalle.sets === 1 ? "serie" : "series"} · {formatKg(detalle.volume_kg)}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold">{MUSCLE_LABELS[activa]}</span>
                  <span className="text-[var(--fg-muted)]"> · sin series en este rango</span>
                </>
              ))}
          </p>

          {max === 0 ? (
            <p className="mt-2 text-sm text-[var(--fg-muted)]">
              Aún no hay series en estas semanas. Cada serie completada enciende su grupo aquí.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--fg-muted)]">
              <span>Series:</span>
              <span className="inline-flex items-center gap-1">
                <Swatch step={0} /> 0
              </span>
              {heatLegend(max).map(({ step, from, to }) => (
                <span key={step} className="texto-dato inline-flex items-center gap-1">
                  <Swatch step={step} />
                  {from === to ? from : `${from}–${to}`}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-[var(--fg-muted)]">Cada serie cuenta para el grupo principal del ejercicio.</p>

          {/* sr-only en un div, no en la tabla: una <table> ignora width:1px, crece a su
              contenido y provoca scroll horizontal en moviles */}
          <div className="sr-only">
            <table>
              <caption>Series y volumen por grupo muscular, últimas {weeks} semanas</caption>
              <thead>
                <tr>
                  <th scope="col">Grupo</th>
                  <th scope="col">Series</th>
                  <th scope="col">Volumen</th>
                </tr>
              </thead>
              <tbody>
                {[...EN_CUERPO, ...FUERA_DEL_CUERPO].map((g) => {
                  const p = byGroup.get(g);
                  return (
                    <tr key={g}>
                      <th scope="row">{MUSCLE_LABELS[g]}</th>
                      <td>{p?.sets ?? 0}</td>
                      <td>{formatKg(p?.volume_kg ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
