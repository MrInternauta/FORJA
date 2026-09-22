"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, X } from "lucide-react";
import { discardLocalWorkout, getActiveLocalWorkout, type LocalWorkout } from "@/lib/offline/db";

const POLL_MS = 3000;

/**
 * Pildora flotante (plan §6.1): salir de /sesion "minimiza" — la sesion sigue
 * viva en Dexie y esta pildora, visible en el resto del shell, permite volver.
 */
export function SesionPildora() {
  const router = useRouter();
  const [active, setActive] = useState<LocalWorkout | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      void getActiveLocalWorkout().then((w) => {
        if (!cancelled) setActive(w ?? null);
      });
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const startedMs = new Date(active.started_at).getTime();
    const tick = () => setElapsed(Math.round((Date.now() - startedMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active?.id, active?.started_at]);

  if (!active) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div
      className="fixed inset-x-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] px-3 py-2 shadow-lg backdrop-blur-xl lg:inset-x-auto lg:bottom-4 lg:left-60 lg:right-4"
    >
      <button
        type="button"
        onClick={() => router.push(`/sesion?resume=${active.id}`)}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)]">
          <Dumbbell size={16} strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg)]">{active.title}</span>
        <span className="texto-dato shrink-0 text-sm text-[var(--fg-muted)]">
          {mins}:{secs}
        </span>
      </button>
      <button
        type="button"
        onClick={() => void discardLocalWorkout(active.id).then(() => setActive(null))}
        aria-label="Descartar entrenamiento"
        className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--fg-muted)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--danger)]"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
