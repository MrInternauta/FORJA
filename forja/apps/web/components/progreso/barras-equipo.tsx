"use client";

import { useCallback, useEffect, useState } from "react";
import type { DistributionPoint, EquipmentType } from "@forja/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { EQUIPMENT_LABELS } from "@/lib/labels";
import { rangeStart } from "@/lib/progreso/heatmap";
import { formatKg, type RangoSemanas } from "@/lib/progreso/volumen";

type Estado = { fase: "cargando" } | { fase: "error" } | { fase: "listo"; points: DistributionPoint[] };

/**
 * "Por máquina" (wireframe §6.2): series completadas por tipo de equipo en el
 * rango de la pantalla. Barras horizontales (nombres largos) de una sola serie:
 * un solo gris recesivo, sin leyenda; el valor va en la punta de cada barra.
 * Series y no kg, igual que el heatmap: el peso corporal registra 0 kg.
 * Datos de `GET /analytics/distribution?by=equipment`.
 */
export function BarrasEquipo({ weeks }: { weeks: RangoSemanas }) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);
  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vigente = true;
    setEstado({ fase: "cargando" });
    const from = encodeURIComponent(rangeStart(weeks));
    api<DistributionPoint[]>(`/analytics/distribution?by=equipment&from=${from}`)
      // La API ordena por volumen; aqui la medida es series.
      .then((points) => vigente && setEstado({ fase: "listo", points: [...points].sort((a, b) => b.sets - a.sets) }))
      .catch(() => vigente && setEstado({ fase: "error" }));
    return () => {
      vigente = false;
    };
  }, [weeks, intento]);

  const points = estado.fase === "listo" ? estado.points : [];
  const max = Math.max(1, ...points.map((p) => p.sets));
  const label = (key: string) => EQUIPMENT_LABELS[key as EquipmentType] ?? key;

  return (
    <Card>
      <div className="mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Por máquina</h2>
        <p className="mt-0.5 text-xs text-[var(--fg-muted)]">Series completadas · últimas {weeks} semanas</p>
      </div>

      {estado.fase === "cargando" && (
        <div aria-busy="true" aria-label="Cargando series por máquina" className="flex flex-col gap-3">
          {[90, 65, 40].map((w) => (
            <div key={w} className="flex items-center gap-3">
              <div className="h-3 w-24 animate-pulse rounded bg-[var(--border)]" />
              <div className="h-3 animate-pulse rounded bg-[var(--border)]" style={{ width: `${w * 0.6}%` }} />
            </div>
          ))}
        </div>
      )}

      {estado.fase === "error" && (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-[var(--fg-muted)]">
            No pudimos cargar tus series por máquina. Están a salvo; se muestran al volver la conexión.
          </p>
          <Button variant="ghost" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      )}

      {estado.fase === "listo" &&
        (points.length === 0 ? (
          <p className="text-sm text-[var(--fg-muted)]">
            Aún no hay series en estas semanas. Aquí verás qué equipo usas más.
          </p>
        ) : (
          <>
            {/* Lista visual; la tabla sr-only de abajo es la version para lectores de pantalla */}
            <ul aria-hidden className="flex flex-col gap-3">
              {points.map((p) => (
                <li key={p.key} className="grid grid-cols-[8.5rem_1fr] items-center gap-3">
                  <span className="truncate text-sm text-[var(--fg)]">{label(p.key)}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-3 shrink-0 rounded-r-[4px]"
                      style={{
                        // Tope al 85%: deja sitio al valor en la punta de la barra mas larga.
                        width: `${(p.sets / max) * 85}%`,
                        background: "color-mix(in srgb, var(--fg-muted) 80%, var(--surface))",
                      }}
                    />
                    <span className="texto-dato shrink-0 text-xs text-[var(--fg-muted)]">{p.sets}</span>
                  </span>
                </li>
              ))}
            </ul>

            {/* sr-only en un div, no en la tabla: una <table> ignora width:1px, crece a su
                contenido y provoca scroll horizontal en moviles */}
            <div className="sr-only">
              <table>
                <caption>Series y volumen por tipo de equipo, últimas {weeks} semanas</caption>
                <thead>
                  <tr>
                    <th scope="col">Equipo</th>
                    <th scope="col">Series</th>
                    <th scope="col">Volumen</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.key}>
                      <th scope="row">{label(p.key)}</th>
                      <td>{p.sets}</td>
                      <td>{formatKg(p.volume_kg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ))}
    </Card>
  );
}
