"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MuscleGroup, PersonalRecord } from "@forja/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { MUSCLE_LABELS } from "@/lib/labels";
import { formatPeso, haceCuanto } from "@/lib/progreso/prs";

/** Cuantos se ven antes de "Ver todos": la tarjeta comparte pantalla con la grafica. */
const VISIBLES = 5;

type Estado = { fase: "cargando" } | { fase: "error" } | { fase: "listo"; prs: PersonalRecord[] };

/**
 * Tarjeta "Récords personales" (wireframe §6.2). PR = mas peso por ejercicio
 * (desempate por reps) en sesiones terminadas; lo calcula el backend al sincronizar.
 * Es historica: el selector de semanas de la pantalla no la acota.
 */
export function RecordsPersonales() {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);
  const [todos, setTodos] = useState(false);
  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vigente = true;
    setEstado({ fase: "cargando" });
    api<PersonalRecord[]>("/analytics/prs")
      .then((prs) => vigente && setEstado({ fase: "listo", prs }))
      .catch(() => vigente && setEstado({ fase: "error" }));
    return () => {
      vigente = false;
    };
  }, [intento]);

  const prs = estado.fase === "listo" ? estado.prs : [];
  const visibles = todos ? prs : prs.slice(0, VISIBLES);

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
          Récords personales
        </h2>
        {prs.length > 0 && <span className="texto-dato text-sm text-[var(--fg-muted)]">{prs.length}</span>}
      </div>

      {estado.fase === "cargando" && (
        <ul aria-busy="true" aria-label="Cargando récords" className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center justify-between">
              <div className="flex flex-col gap-1.5">
                <div className="h-4 w-36 animate-pulse rounded bg-[var(--border)]" />
                <div className="h-3 w-20 animate-pulse rounded bg-[var(--border)]" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded bg-[var(--border)]" />
            </li>
          ))}
        </ul>
      )}

      {estado.fase === "error" && (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-[var(--fg-muted)]">
            No pudimos cargar tus récords. Siguen guardados; se muestran al volver la conexión.
          </p>
          <Button variant="ghost" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      )}

      {estado.fase === "listo" && prs.length === 0 && (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-[var(--fg-muted)]">
            Tu primer récord llega al terminar tu primera sesión: cada ejercicio arranca uno.
          </p>
          <Link
            href="/sesion"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            ▶ Empieza un entrenamiento
          </Link>
        </div>
      )}

      {visibles.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {visibles.map((pr) => (
            <li key={pr.exercise_id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--fg)]">{pr.exercise_name}</p>
                <p className="text-xs text-[var(--fg-muted)]">
                  {MUSCLE_LABELS[pr.muscle_group as MuscleGroup] ?? pr.muscle_group} ·{" "}
                  <time dateTime={pr.achieved_at}>{haceCuanto(pr.achieved_at)}</time>
                </p>
              </div>
              <p className="shrink-0 text-right">
                <span className="texto-dato font-bold text-[var(--accent)]">{formatPeso(pr.weight_kg)} kg</span>
                <span className="texto-dato ml-1 text-sm text-[var(--fg-muted)]">
                  × {pr.reps}
                  <span className="sr-only"> {pr.reps === 1 ? "repetición" : "repeticiones"}</span>
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}

      {prs.length > VISIBLES && (
        <button
          type="button"
          aria-expanded={todos}
          onClick={() => setTodos((v) => !v)}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          {todos ? "Ver menos" : `Ver todos (${prs.length})`}
        </button>
      )}
    </Card>
  );
}
