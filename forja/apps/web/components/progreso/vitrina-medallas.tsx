"use client";

import { useCallback, useEffect, useState } from "react";
import type { AchievementMetric, AchievementStatus } from "@forja/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { METRIC_LABELS, TIER_LABELS } from "@/lib/labels";
import { haceCuanto } from "@/lib/progreso/prs";
import { formatKg } from "@/lib/progreso/volumen";

type Estado = { fase: "cargando" } | { fase: "error" } | { fase: "listo"; logros: AchievementStatus[] };

const UNIDADES: Record<AchievementMetric, (n: number) => string> = {
  workouts: (n) => `${n} ${n === 1 ? "sesión" : "sesiones"}`,
  volume_kg: (n) => formatKg(n),
  streak_weeks: (n) => `${n} ${n === 1 ? "semana" : "semanas"}`,
  prs: (n) => `${n} ${n === 1 ? "récord" : "récords"}`,
};

/**
 * Medalla con la que abre la vitrina: la bloqueada mas cerca de ganarse (lo que
 * sigue), o la primera si aun no hay progreso. Sin cuentas regresivas ni FOMO (§8.2).
 */
function siguiente(logros: AchievementStatus[]): string | null {
  const bloqueadas = logros.filter((l) => !l.earned_at && l.progress && l.progress.current > 0);
  const ratio = (l: AchievementStatus) => l.progress!.current / l.progress!.target;
  bloqueadas.sort((a, b) => ratio(b) - ratio(a));
  return bloqueadas[0]?.id ?? logros[0]?.id ?? null;
}

/** MedallaLogro (§5): rombo de metal. Ganada = metal de su tier; bloqueada = silueta. */
function MedallaLogro({ logro, activa, onSelect }: { logro: AchievementStatus; activa: boolean; onSelect: () => void }) {
  const ganada = logro.earned_at !== null;
  const metal = `var(--tier-${logro.tier})`;
  return (
    <button
      type="button"
      aria-pressed={activa}
      aria-label={`${logro.name}, ${TIER_LABELS[logro.tier]}, ${ganada ? "ganada" : "bloqueada"}`}
      onClick={onSelect}
      className={`grid h-12 w-12 place-items-center rounded-[var(--radius-control)] transition-colors duration-[var(--duration-fast)] ${
        activa ? "bg-[var(--bg)] ring-1 ring-[var(--fg-muted)]" : "hover:bg-[var(--bg)]"
      }`}
    >
      <span
        aria-hidden
        className="grid h-7 w-7 rotate-45 place-items-center rounded-[4px]"
        style={
          ganada
            ? { border: `2px solid ${metal}`, background: `color-mix(in srgb, ${metal} 22%, transparent)` }
            : // Silueta, pero con contraste >=3:1: es un control tactil (WCAG 1.4.11)
              { border: "1.5px solid color-mix(in srgb, var(--fg-muted) 80%, var(--surface))" }
        }
      >
        {ganada && <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: metal }} />}
      </span>
    </button>
  );
}

function Detalle({ logro }: { logro: AchievementStatus }) {
  const { progress } = logro;
  return (
    <div aria-live="polite" className="mt-4 rounded-[var(--radius-control)] border border-[var(--border)] p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold text-[var(--fg)]">{logro.name}</p>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--fg-muted)]">
          <span aria-hidden className="h-2 w-2 rotate-45 rounded-[1px]" style={{ background: `var(--tier-${logro.tier})` }} />
          {TIER_LABELS[logro.tier]}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{logro.description}</p>

      {logro.earned_at ? (
        <p className="mt-2 text-sm text-[var(--fg)]">
          Ganada <time dateTime={logro.earned_at}>{haceCuanto(logro.earned_at)}</time>
        </p>
      ) : progress ? (
        <div className="mt-3">
          {/* El oro se reserva para lo ganado: el avance va en gris (§1 "aspiracional") */}
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.target}
            aria-valuenow={progress.current}
            aria-valuetext={`${UNIDADES[logro.metric](progress.current)} de ${UNIDADES[logro.metric](progress.target)}`}
            className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]"
          >
            <div
              className="h-full rounded-full bg-[var(--fg-muted)]"
              style={{ width: `${(progress.current / progress.target) * 100}%` }}
            />
          </div>
          <p className="texto-dato mt-1.5 text-xs text-[var(--fg-muted)]">
            {UNIDADES[logro.metric](progress.current)} / {UNIDADES[logro.metric](progress.target)}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--fg-muted)]">Aún no llevamos la cuenta de esta medalla; llega pronto.</p>
      )}
    </div>
  );
}

/**
 * Vitrina de medallas (§8.1): todo el catalogo, ganadas en su metal y bloqueadas
 * en silueta para que se vea lo que falta. Datos de `GET /me/achievements`.
 */
export function VitrinaMedallas({ className = "" }: { className?: string }) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);
  const [activa, setActiva] = useState<string | null>(null);
  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vigente = true;
    setEstado({ fase: "cargando" });
    api<AchievementStatus[]>("/me/achievements")
      .then((logros) => {
        if (!vigente) return;
        setEstado({ fase: "listo", logros });
        setActiva((a) => a ?? siguiente(logros));
      })
      .catch(() => vigente && setEstado({ fase: "error" }));
    return () => {
      vigente = false;
    };
  }, [intento]);

  const logros = estado.fase === "listo" ? estado.logros : [];
  const ganadas = logros.filter((l) => l.earned_at).length;
  const seleccionada = logros.find((l) => l.id === activa);

  return (
    <Card className={className}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
          Vitrina de medallas
        </h2>
        {estado.fase === "listo" && (
          <span className="texto-dato text-sm text-[var(--fg-muted)]">
            {ganadas}/{logros.length}
            <span className="sr-only"> medallas ganadas</span>
          </span>
        )}
      </div>

      {estado.fase === "cargando" && (
        <div aria-busy="true" aria-label="Cargando medallas" className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="grid h-12 w-12 place-items-center">
              <div className="h-7 w-7 rotate-45 animate-pulse rounded-[4px] bg-[var(--border)]" />
            </div>
          ))}
        </div>
      )}

      {estado.fase === "error" && (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-[var(--fg-muted)]">
            No pudimos cargar tus medallas. Las ganadas no se pierden; se muestran al volver la conexión.
          </p>
          <Button variant="ghost" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      )}

      {estado.fase === "listo" && (
        <>
          <div className="flex flex-col gap-3">
            {/* Orden de METRIC_LABELS. No importar ACHIEVEMENT_METRICS de @forja/shared: arrastraba zod (+14 kB). */}
            {(Object.keys(METRIC_LABELS) as AchievementMetric[]).map((metric) => {
              const grupo = logros.filter((l) => l.metric === metric);
              if (grupo.length === 0) return null;
              return (
                <div key={metric} role="group" aria-label={METRIC_LABELS[metric]}>
                  <p className="mb-1 text-xs text-[var(--fg-muted)]">{METRIC_LABELS[metric]}</p>
                  <div className="flex flex-wrap gap-1">
                    {grupo.map((l) => (
                      <MedallaLogro key={l.id} logro={l} activa={l.id === activa} onSelect={() => setActiva(l.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {seleccionada && <Detalle logro={seleccionada} />}
        </>
      )}
    </Card>
  );
}
