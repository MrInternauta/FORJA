"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { EquipmentType, MuscleGroup } from "@forja/shared";
import { CreateExerciseSchema, EQUIPMENT_TYPES, MUSCLE_GROUPS } from "@forja/shared";
import { api, ApiError } from "@/lib/api";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

/** Alta de ejercicio (solo ADMIN; el backend lo refuerza con @Roles + RLS). */
export function NuevoEjercicioForm({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup>("chest");
  const [equipment, setEquipment] = useState<EquipmentType>("barbell");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = CreateExerciseSchema.safeParse({
      name: name.trim(),
      description: description.trim() || undefined,
      muscle_group: muscle,
      equipment,
      secondary_muscles: [],
    });
    if (!parsed.success) {
      setError("Revisa el nombre del ejercicio.");
      return;
    }

    setSaving(true);
    try {
      await api("/exercises", { method: "POST", body: parsed.data });
      onCreated();
    } catch (err) {
      setSaving(false);
      setError(
        err instanceof ApiError && err.status === 403
          ? "Tu rol no permite crear ejercicios."
          : "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.",
      );
    }
  }

  const selectClass =
    "superficie min-h-11 rounded-[var(--radius-control)] px-3 text-[var(--fg)] bg-[var(--surface)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 lg:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Nuevo ejercicio"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 lg:rounded-[var(--radius-card)]"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="texto-display text-lg text-[var(--fg)]">Nuevo ejercicio</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="superficie flex h-9 w-9 items-center justify-center"
          >
            <X size={16} strokeWidth={1.75} className="text-[var(--fg-muted)]" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
            Nombre
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="superficie min-h-11 rounded-[var(--radius-control)] px-3 text-[var(--fg)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
            Descripción <span className="opacity-60">(opcional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="superficie rounded-[var(--radius-control)] px-3 py-2 text-[var(--fg)]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
              Grupo muscular
              <select
                value={muscle}
                onChange={(e) => setMuscle(e.target.value as MuscleGroup)}
                className={selectClass}
              >
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m} value={m}>
                    {MUSCLE_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
              Equipamiento
              <select
                value={equipment}
                onChange={(e) => setEquipment(e.target.value as EquipmentType)}
                className={selectClass}
              >
                {EQUIPMENT_TYPES.map((eq) => (
                  <option key={eq} value={eq}>
                    {EQUIPMENT_LABELS[eq]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="text-sm text-[var(--color-alerta)]">{error}</p>}

          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Guardar ejercicio"}
          </Button>
        </div>
      </form>
    </div>
  );
}
