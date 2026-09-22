"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { WeeklySummary } from "@forja/shared";
import { AnilloForja } from "@/components/forja/anillo-forja";
import { RachaChip } from "@/components/forja/racha";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { TIER_LABELS } from "@/lib/labels";
import { formatPeso } from "@/lib/progreso/prs";
import { compararVolumen, resumenCopy, shiftWeek } from "@/lib/progreso/resumen";
import { formatKg, formatWeek } from "@/lib/progreso/volumen";

type Estado = { fase: "cargando" } | { fase: "error" } | { fase: "listo"; resumen: WeeklySummary };

const navBtn =
  "grid h-11 w-11 place-items-center rounded-[var(--radius-control)] text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)] disabled:pointer-events-none disabled:opacity-40";

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-[var(--fg-muted)]">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

/**
 * Resumen semanal (diseno §8.1: "cada lunes: volumen vs. semana anterior, racha,
 * medallas nuevas"). Abre en la ultima semana completa; las flechas recorren las
 * anteriores. El AnilloForja igniciona solo si se cumplio el objetivo: es el
 * unico momento de logro de la tarjeta. Datos de `GET /analytics/weekly-summary`.
 */
export function ResumenSemanal({ className = "" }: { className?: string }) {
  const [week, setWeek] = useState<string | undefined>(undefined);
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);
  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vigente = true;
    setEstado({ fase: "cargando" });
    api<WeeklySummary>(`/analytics/weekly-summary${week ? `?week=${week}` : ""}`)
      .then((resumen) => vigente && setEstado({ fase: "listo", resumen }))
      .catch(() => vigente && setEstado({ fase: "error" }));
    return () => {
      vigente = false;
    };
  }, [week, intento]);

  const r = estado.fase === "listo" ? estado.resumen : null;
  const comparacion = r ? compararVolumen(r.volume_kg, r.previous_volume_kg) : null;

  return (
    <Card className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Resumen semanal</h2>
        <div className="ml-auto flex items-center">
          <button
            type="button"
            aria-label="Semana anterior"
            disabled={!r}
            onClick={() => r && setWeek(shiftWeek(r.week_start, -1))}
            className={navBtn}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <span aria-live="polite" className="whitespace-nowrap text-center text-sm text-[var(--fg)]">
            {r ? (r.is_latest ? "Semana pasada" : `Sem. del ${formatWeek(r.week_start)}`) : "…"}
          </span>
          <button
            type="button"
            aria-label="Semana siguiente"
            disabled={!r || r.is_latest}
            onClick={() => r && setWeek(shiftWeek(r.week_start, 1))}
            className={navBtn}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
      </div>

      {estado.fase === "cargando" && (
        <div aria-busy="true" aria-label="Cargando resumen semanal" className="flex items-center gap-5">
          <div className="h-[120px] w-[120px] shrink-0 animate-pulse rounded-full bg-[var(--border)]" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--border)]" />
          </div>
        </div>
      )}

      {estado.fase === "error" && (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-[var(--fg-muted)]">
            No pudimos cargar el resumen. Tus entrenamientos están a salvo; se muestra al volver la conexión.
          </p>
          <Button variant="ghost" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      )}

      {r && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center gap-4 sm:flex-col sm:items-center sm:gap-2">
            <AnilloForja
              size={120}
              value={r.sessions}
              max={r.weekly_goal}
              ignited={r.goal_met}
              label={`Sesiones de la semana: ${r.sessions} de ${r.weekly_goal}`}
            >
              <span className="texto-dato text-2xl font-bold text-[var(--fg)]">
                {r.sessions}
                <span className="text-[var(--fg-muted)]">/{r.weekly_goal}</span>
              </span>
              <span className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">sesiones</span>
            </AnilloForja>
            <p className="text-sm text-[var(--fg)] sm:max-w-40 sm:text-center">{resumenCopy(r)}</p>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {/* Fila que envuelve: a 320 px los valores no se parten ("9,420 / kg") */}
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Dato label="Volumen">
                <p className="texto-dato whitespace-nowrap font-bold text-[var(--fg)]">{formatKg(r.volume_kg)}</p>
                {comparacion?.kind === "sube" && (
                  <p className="texto-dato whitespace-nowrap text-xs text-[var(--positive)]">↑{comparacion.pct}% vs anterior</p>
                )}
                {comparacion?.kind === "baja" && (
                  <p className="texto-dato whitespace-nowrap text-xs text-[var(--fg-muted)]">Anterior: {formatKg(comparacion.anterior)}</p>
                )}
              </Dato>
              <Dato label="Series">
                <p className="texto-dato font-bold text-[var(--fg)]">{r.sets}</p>
              </Dato>
              {/* La racha es la de HOY: solo tiene sentido junto a la semana mas reciente */}
              {r.is_latest ? (
                <Dato label="Racha">
                  <RachaChip weeks={r.current_streak} />
                </Dato>
              ) : (
                <Dato label="Récords">
                  <p className="texto-dato font-bold text-[var(--fg)]">{r.prs.length}</p>
                </Dato>
              )}
            </div>

            {r.prs.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-[var(--fg-muted)]">
                  {r.prs.length === 1 ? "Récord de la semana" : `Récords de la semana (${r.prs.length})`}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {r.prs.map((pr) => (
                    <li
                      key={pr.exercise_id}
                      className="rounded-[var(--radius-control)] border border-[var(--border)] px-2.5 py-1 text-sm"
                    >
                      <span className="text-[var(--fg)]">{pr.exercise_name}</span>{" "}
                      <span className="texto-dato font-bold text-[var(--accent)]">
                        {formatPeso(pr.weight_kg)} kg × {pr.reps}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {r.achievements.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-[var(--fg-muted)]">Medallas nuevas</p>
                <ul className="flex flex-wrap gap-2">
                  {r.achievements.map((a) => (
                    <li
                      key={a.id}
                      className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] px-2.5 py-1 text-sm text-[var(--fg)]"
                    >
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 rotate-45 rounded-[2px]"
                        style={{ background: `var(--tier-${a.tier})` }}
                      />
                      {a.name}
                      <span className="sr-only"> ({TIER_LABELS[a.tier]})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
