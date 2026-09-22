"use client";

import { useState } from "react";
import { BarrasEquipo } from "@/components/progreso/barras-equipo";
import { HeatmapMuscular } from "@/components/progreso/heatmap-muscular";
import { ResumenSemanal } from "@/components/progreso/resumen-semanal";
import { RecordsPersonales } from "@/components/progreso/records-personales";
import { VitrinaMedallas } from "@/components/progreso/vitrina-medallas";
import { VolumenSemanal } from "@/components/progreso/volumen-semanal";
import { RANGOS_SEMANAS, type RangoSemanas } from "@/lib/progreso/volumen";

/** Panel de progreso (wireframe §6.2). El selector de rango acota volumen, grupos musculares y máquinas; récords y medallas son históricos; el resumen navega por semana. */
export function ProgresoVista() {
  const [weeks, setWeeks] = useState<RangoSemanas>(12);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
      <h1 className="texto-display text-xl text-[var(--fg)] lg:col-span-2">Progreso</h1>

      <ResumenSemanal className="lg:col-span-2" />

      {/* El selector acota solo lo que tiene debajo y depende del rango (dataviz: filtros encima de lo que filtran) */}
      <div className="flex items-center justify-between gap-4 lg:col-span-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Tendencias</h2>
        <div
          role="group"
          aria-label="Rango de semanas"
          className="flex rounded-[var(--radius-control)] border border-[var(--border)] p-0.5"
        >
          {RANGOS_SEMANAS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={weeks === r}
              onClick={() => setWeeks(r)}
              className={`texto-dato min-h-11 min-w-14 rounded-[calc(var(--radius-control)-2px)] px-3 text-sm transition-colors duration-[var(--duration-fast)] ${
                weeks === r
                  ? "bg-[var(--surface)] font-bold text-[var(--fg)]"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              {r} sem
            </button>
          ))}
        </div>
      </div>

      <VolumenSemanal weeks={weeks} />

      <HeatmapMuscular weeks={weeks} />

      <BarrasEquipo weeks={weeks} />

      <RecordsPersonales />

      <VitrinaMedallas className="lg:col-span-2" />
    </div>
  );
}
