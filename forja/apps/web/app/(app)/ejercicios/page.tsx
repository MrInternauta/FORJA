"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import type { Exercise, MuscleGroup } from "@forja/shared";
import { MUSCLE_GROUPS } from "@forja/shared";
import { api } from "@/lib/api";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/labels";
import { useMe } from "@/components/auth/auth-gate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NuevoEjercicioForm } from "@/components/catalogo/nuevo-ejercicio-form";

interface ListResponse {
  items: Exercise[];
  next_cursor: string | null;
}

/**
 * Catalogo / selector de ejercicio (plan §6.2): buscador, chips por grupo
 * muscular, lista y detalle en sheet. El SW lo cachea SWR => lectura offline.
 */
export default function EjerciciosPage() {
  const { profile } = useMe();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [items, setItems] = useState<Exercise[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [showForm, setShowForm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const buildQuery = useCallback(
    (cursorArg?: string) => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (muscle) params.set("muscle_group", muscle);
      if (cursorArg) params.set("cursor", cursorArg);
      const s = params.toString();
      return `/exercises${s ? `?${s}` : ""}`;
    },
    [q, muscle],
  );

  const load = useCallback(() => {
    setItems(null);
    api<ListResponse>(buildQuery())
      .then((res) => {
        setItems(res.items);
        setCursor(res.next_cursor);
      })
      .catch(() => {
        setItems([]);
        setCursor(null);
      });
  }, [buildQuery]);

  // Busqueda con debounce de 300ms; filtros aplican al instante.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, q ? 300 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [load, q]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await api<ListResponse>(buildQuery(cursor));
      setItems((prev) => [...(prev ?? []), ...res.items]);
      setCursor(res.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="texto-display text-xl text-[var(--fg)]">Ejercicios</h1>
        {profile.role === "ADMIN" && (
          <Button variant="ghost" onClick={() => setShowForm(true)}>
            <Plus size={16} strokeWidth={2} aria-hidden />
            Nuevo ejercicio
          </Button>
        )}
      </header>

      {/* Buscador */}
      <label className="superficie flex min-h-11 items-center gap-2 px-3">
        <Search size={16} strokeWidth={1.75} className="text-[var(--fg-muted)]" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar ejercicio"
          aria-label="Buscar ejercicio"
          className="w-full bg-transparent text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:outline-none"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Limpiar búsqueda">
            <X size={16} strokeWidth={1.75} className="text-[var(--fg-muted)]" />
          </button>
        )}
      </label>

      {/* Chips por grupo muscular (scroll horizontal en movil) */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrar por grupo muscular">
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

      {/* Lista */}
      {items === null ? (
        <div className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="superficie h-16 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="text-sm text-[var(--fg-muted)]">
          Sin resultados con estos filtros. Prueba con otro término o quita el filtro.
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => setDetail(ex)}
                className="superficie flex w-full items-center justify-between gap-3 p-4 text-left transition-colors duration-[var(--duration-fast)] hover:border-[var(--accent)]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--fg)]">{ex.name}</p>
                  <p className="text-sm text-[var(--fg-muted)]">
                    {MUSCLE_LABELS[ex.muscle_group]} · {EQUIPMENT_LABELS[ex.equipment]}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <Button variant="ghost" onClick={loadMore} disabled={loadingMore} className="self-center">
          {loadingMore ? "Cargando…" : "Cargar más"}
        </Button>
      )}

      {/* Detalle en sheet */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 lg:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={detail.name}
          onClick={() => setDetail(null)}
        >
          <div
            className="vidrio w-full max-w-lg rounded-t-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 lg:rounded-[var(--radius-card)]"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="texto-display text-lg text-[var(--fg)]">{detail.name}</h2>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">
                  {MUSCLE_LABELS[detail.muscle_group]} · {EQUIPMENT_LABELS[detail.equipment]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Cerrar"
                className="superficie flex h-9 w-9 shrink-0 items-center justify-center"
              >
                <X size={16} strokeWidth={1.75} className="text-[var(--fg-muted)]" />
              </button>
            </div>

            {/* Media demostrativa: placeholder hasta subir media (pregunta abierta #2) */}
            <div className="mb-4 flex aspect-video items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg)] text-xs uppercase tracking-wider text-[var(--fg-muted)]">
              media demostrativa
            </div>

            {detail.description && (
              <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{detail.description}</p>
            )}
            {detail.secondary_muscles.length > 0 && (
              <p className="mt-3 text-xs text-[var(--fg-muted)]">
                También trabaja: {detail.secondary_muscles.map((m) => MUSCLE_LABELS[m]).join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <NuevoEjercicioForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}
