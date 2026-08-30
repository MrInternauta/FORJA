import type { Metadata } from "next";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Progreso" };

/** Panel de progreso (wireframe §6.2). Barras mock hasta conectar /analytics/volume. */
const MOCK_WEEKS = [5200, 6100, 5800, 4900, 7300, 8100, 8420];
const MOCK_PRS = [
  { name: "Sentadilla trasera", weight: 140, when: "hace 3 días" },
  { name: "Press banca", weight: 85, when: "hace 9 días" },
];
const MEDALLAS_GANADAS = 3;
const MEDALLAS_TOTAL = 15;

export default function ProgresoPage() {
  const max = Math.max(...MOCK_WEEKS);
  const delta = Math.round(
    ((MOCK_WEEKS[MOCK_WEEKS.length - 1] - MOCK_WEEKS[MOCK_WEEKS.length - 2]) /
      MOCK_WEEKS[MOCK_WEEKS.length - 2]) *
      100,
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
      <h1 className="texto-display text-xl text-[var(--fg)] lg:col-span-2">Progreso</h1>

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
            Volumen semanal
          </h2>
          <span
            className={`texto-dato text-sm font-bold ${delta >= 0 ? "text-[var(--color-senal)]" : "text-[var(--fg-muted)]"}`}
          >
            {delta >= 0 ? "↑" : "↓"}
            {Math.abs(delta)}% vs sem. pasada
          </span>
        </div>
        <div className="flex h-28 items-end gap-2" role="img" aria-label="Volumen de las últimas 7 semanas">
          {MOCK_WEEKS.map((v, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t ${i === MOCK_WEEKS.length - 1 ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
              style={{ height: `${(v / max) * 100}%` }}
            />
          ))}
        </div>
      </Card>

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
