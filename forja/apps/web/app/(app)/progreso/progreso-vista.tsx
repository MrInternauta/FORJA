"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { VolumenSemanal } from "@/components/progreso/volumen-semanal";
import { RANGOS_SEMANAS, type RangoSemanas } from "@/lib/progreso/volumen";

// TODO(sem. 12-13): PRs y medallas aun son mock; siguen GET /analytics/prs y user_achievements.
const MOCK_PRS = [
  { name: "Sentadilla trasera", weight: 140, when: "hace 3 días" },
  { name: "Press banca", weight: 85, when: "hace 9 días" },
];
const MEDALLAS_GANADAS = 3;
const MEDALLAS_TOTAL = 15;

/** Panel de progreso (wireframe §6.2). El selector de rango encabeza y acota la pantalla. */
export function ProgresoVista() {
  const [weeks, setWeeks] = useState<RangoSemanas>(12);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
      <header className="flex items-center justify-between gap-4 lg:col-span-2">
        <h1 className="texto-display text-xl text-[var(--fg)]">Progreso</h1>
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
      </header>

      <VolumenSemanal weeks={weeks} />

      <Card>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
          Récords personales
        </h2>
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {MOCK_PRS.map((pr) => (
            <li key={pr.name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div>
                <p className="font-medium text-[var(--fg)]">{pr.name}</p>
                <p className="text-xs text-[var(--fg-muted)]">{pr.when}</p>
              </div>
              <span className="texto-dato font-bold text-[var(--accent)]">{pr.weight} kg</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="lg:col-span-2">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
            Vitrina de medallas
          </h2>
          <span className="texto-dato text-sm text-[var(--fg-muted)]">
            {MEDALLAS_GANADAS}/{MEDALLAS_TOTAL}
          </span>
        </div>
        {/* Medallas bloqueadas en silueta: se ve lo que falta (aspiracional, §8.1) */}
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: MEDALLAS_TOTAL }).map((_, i) => (
            <div
              key={i}
              aria-hidden
              className={`h-10 w-10 rotate-45 rounded-[4px] border ${
                i < MEDALLAS_GANADAS
                  ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
                  : "border-[var(--border)]"
              }`}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
