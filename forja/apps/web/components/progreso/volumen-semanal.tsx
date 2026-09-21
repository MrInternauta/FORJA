"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { WeeklyVolumePoint } from "@forja/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { GraficaVolumen } from "./grafica-volumen";
import { fillWeeks, formatKg, weekOverWeek, type RangoSemanas } from "@/lib/progreso/volumen";

type Estado =
  | { fase: "cargando" }
  | { fase: "error" }
  | { fase: "listo"; points: WeeklyVolumePoint[] };

/**
 * Tarjeta "Volumen semanal" de Progreso (wireframe §6.2). Datos de
 * `GET /analytics/volume`; offline el SW sirve la ultima respuesta (Network-First).
 */
export function VolumenSemanal({ weeks }: { weeks: RangoSemanas }) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);
  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vigente = true; // descarta respuestas de un rango anterior
    setEstado({ fase: "cargando" });
    api<WeeklyVolumePoint[]>(`/analytics/volume?weeks=${weeks}`)
      .then((points) => vigente && setEstado({ fase: "listo", points: fillWeeks(points, weeks) }))
      .catch(() => vigente && setEstado({ fase: "error" }));
    return () => {
      vigente = false;
    };
  }, [weeks, intento]);

  return (
    <Card>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
          Volumen semanal
        </h2>
        {estado.fase === "listo" && <Comparacion points={estado.points} />}
      </div>

      {estado.fase === "cargando" && <Esqueleto />}

      {estado.fase === "error" && (
        <div className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-[var(--fg-muted)]">
            No pudimos cargar tu volumen. Tus entrenamientos están a salvo; la gráfica se actualiza al
            volver la conexión.
          </p>
          <Button variant="ghost" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      )}

      {estado.fase === "listo" &&
        (estado.points.every((p) => p.volume_kg === 0) ? (
          <div className="flex flex-col items-start gap-3 py-6">
            <p className="text-sm text-[var(--fg-muted)]">
              Aún no hay volumen en {weeks === 4 ? "las últimas 4 semanas" : "las últimas 12 semanas"}. Cada
              serie que completes suma aquí.
            </p>
            <Link
              href="/sesion"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              ▶ Empieza un entrenamiento
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4">
              <span className="texto-dato text-2xl font-bold text-[var(--fg)]">
                {formatKg(estado.points[estado.points.length - 1].volume_kg)}
              </span>
              <span className="ml-2 text-sm text-[var(--fg-muted)]">esta semana</span>
            </p>
            <GraficaVolumen points={estado.points} />
          </>
        ))}
    </Card>
  );
}

/**
 * Comparacion contra tu yo de la semana pasada (§1 "competitivo"). Copy sin culpa:
 * si la semana en curso va por debajo no se muestra un % negativo — la semana
 * aun no termina; solo la referencia de la pasada.
 */
function Comparacion({ points }: { points: WeeklyVolumePoint[] }) {
  const delta = weekOverWeek(points);
  if (delta === null) return null;
  if (delta >= 0) {
    return (
      <span className="texto-dato text-sm font-bold text-[var(--positive)]">
        ↑{delta}% vs sem. pasada
      </span>
    );
  }
  return (
    <span className="texto-dato text-sm text-[var(--fg-muted)]">
      Sem. pasada: {formatKg(points[points.length - 2].volume_kg)}
    </span>
  );
}

function Esqueleto() {
  return (
    <div aria-busy="true" aria-label="Cargando volumen semanal" className="flex flex-col gap-4">
      <div className="h-8 w-36 animate-pulse rounded bg-[var(--border)]" />
      <div className="flex h-[168px] items-end gap-3 pl-11">
        {[40, 65, 50, 80, 55, 70, 45].map((h, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-[var(--border)]"
            style={{ height: `${h}%`, maxWidth: 24 }}
          />
        ))}
      </div>
    </div>
  );
}
