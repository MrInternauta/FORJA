"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Dumbbell, Pencil, Play, Plus } from "lucide-react";
import type { RoutineSummary } from "@forja/shared";
import { PLAN_LIMITS } from "@forja/shared";
import { api } from "@/lib/api";
import { useMe } from "@/components/auth/auth-gate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EntrenarPage() {
  const { profile } = useMe();
  const [routines, setRoutines] = useState<RoutineSummary[] | null>(null);

  useEffect(() => {
    api<{ items: RoutineSummary[] }>("/routines")
      .then((res) => setRoutines(res.items))
      .catch(() => setRoutines([]));
  }, []);

  const max = PLAN_LIMITS[profile.role].maxRoutines;
  const atLimit = routines !== null && Number.isFinite(max) && routines.length >= max;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="texto-display text-xl text-[var(--fg)]">Entrenar</h1>
        {routines !== null && routines.length > 0 && (
          <Link
            href="/entrenar/nueva"
            aria-disabled={atLimit}
            className={`superficie flex min-h-10 items-center gap-1.5 px-3 text-sm text-[var(--fg)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--accent)] ${
              atLimit ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <Plus size={15} strokeWidth={2} aria-hidden />
            Nueva
          </Link>
        )}
      </header>

      {routines === null ? (
        <div className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="superficie h-20 animate-pulse" />
          ))}
        </div>
      ) : routines.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <Dumbbell size={32} strokeWidth={1.5} className="text-[var(--fg-muted)]" aria-hidden />
          <div>
            <p className="font-semibold text-[var(--fg)]">Aún no hay rutinas</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              Crea una plantilla o empieza un entrenamiento libre.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/entrenar/nueva"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] transition-[filter] duration-[var(--duration-fast)] hover:brightness-110"
            >
              Nueva rutina
            </Link>
            <Link href="/sesion">
              <Button variant="ghost">Entrenamiento libre</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {routines.map((r) => (
              <li key={r.id}>
                <div className="superficie flex items-center gap-2 p-2 pl-4 transition-colors duration-[var(--duration-fast)] hover:border-[var(--accent)]">
                  <Link href={`/sesion?routine=${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--fg)]">{r.name}</p>
                      <p className="text-sm text-[var(--fg-muted)]">
                        {r.exercise_count} {r.exercise_count === 1 ? "ejercicio" : "ejercicios"}
                        {r.description ? ` · ${r.description}` : ""}
                      </p>
                    </div>
                  </Link>
                  <Link
                    href={`/entrenar/${r.id}/editar`}
                    aria-label={`Editar ${r.name}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  >
                    <Pencil size={16} strokeWidth={1.75} />
                  </Link>
                  <Link
                    href={`/sesion?routine=${r.id}`}
                    aria-label={`Empezar ${r.name}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)]"
                  >
                    <Play size={15} strokeWidth={2.25} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {atLimit && (
            <p className="text-sm text-[var(--fg-muted)]">
              Tu plan permite hasta {max} rutinas. Elimina una o pasa a PRO para crear más.
            </p>
          )}
        </>
      )}

      <Link
        href="/ejercicios"
        className="superficie flex items-center justify-between p-4 transition-colors duration-[var(--duration-fast)] hover:border-[var(--accent)]"
      >
        <div className="flex items-center gap-3">
          <BookOpen size={20} strokeWidth={1.75} className="text-[var(--fg-muted)]" aria-hidden />
          <div>
            <p className="font-medium text-[var(--fg)]">Catálogo de ejercicios</p>
            <p className="text-sm text-[var(--fg-muted)]">
              Explora por grupo muscular y equipamiento
            </p>
          </div>
        </div>
        <span className="text-[var(--fg-muted)]" aria-hidden>
          →
        </span>
      </Link>
    </div>
  );
}
