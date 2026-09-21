"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { Exercise, MuscleGroup } from "@forja/shared";
import { MUSCLE_GROUPS } from "@forja/shared";
import { api } from "@/lib/api";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/labels";
import { Dialogo } from "@/components/ui/dialogo";

interface Props {
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}

/** Sheet selector de ejercicio para el builder (plan §6.2). */
export function ExercisePicker({ onSelect, onClose }: Props) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [items, setItems] = useState<Exercise[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (muscle) params.set("muscle_group", muscle);
    const s = params.toString();
    setItems(null);
    api<{ items: Exercise[] }>(`/exercises${s ? `?${s}` : ""}`)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]));
  }, [q, muscle]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, q ? 300 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [load, q]);

  return (
    <Dialogo
      label="Elegir ejercicio"
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 lg:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-lg flex-col gap-3 rounded-t-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 lg:rounded-[var(--radius-card)]"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="texto-display text-lg text-[var(--fg)]">Elegir ejercicio</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="superficie flex h-11 w-11 items-center justify-center"
          >
            <X size={16} strokeWidth={1.75} className="text-[var(--fg-muted)]" />
          </button>
        </div>

        <label className="superficie flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]">
          <Search size={16} strokeWidth={1.75} className="text-[var(--fg-muted)]" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar ejercicio"
            aria-label="Buscar ejercicio"
            className="w-full bg-transparent text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:outline-none"
          />
        </label>

        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por grupo muscular">
          {MUSCLE_GROUPS.map((m) => {
            const active = muscle === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => setMuscle(active ? null : m)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors duration-[var(--duration-fast)] ${
                  active
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                }`}
              >
                {MUSCLE_LABELS[m]}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {items === null ? (
            <div className="flex flex-col gap-2" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="superficie h-14 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--fg-muted)]">
              Sin resultados. Prueba otro término o quita el filtro.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((ex) => (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(ex)}
                    className="superficie flex w-full items-center justify-between p-3 text-left transition-colors duration-[var(--duration-fast)] hover:border-[var(--accent)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--fg)]">{ex.name}</p>
                      <p className="text-sm text-[var(--fg-muted)]">
                        {MUSCLE_LABELS[ex.muscle_group]} · {EQUIPMENT_LABELS[ex.equipment]}
                      </p>
                    </div>
                    <span className="text-[var(--fg-muted)]" aria-hidden>
                      +
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialogo>
  );
}
