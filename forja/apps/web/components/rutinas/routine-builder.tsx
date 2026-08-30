"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import type { CreateRoutineInput, Exercise, MuscleGroup, RoutineDetail } from "@forja/shared";
import { CreateRoutineSchema } from "@forja/shared";
import { api, ApiError } from "@/lib/api";
import { MUSCLE_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExercisePicker } from "./exercise-picker";

/* Estado del borrador: strings en inputs, numeros al guardar. */
interface DraftSet {
  target_reps: string;
  target_weight_kg: string;
  target_rpe: string;
}
interface DraftExercise {
  key: string;
  exercise_id: string;
  name: string;
  muscle_group: MuscleGroup;
  notes: string;
  sets: DraftSet[];
}

interface Props {
  /** Presente en modo edicion. */
  routineId?: string;
  initial?: RoutineDetail;
}

const EMPTY_SET: DraftSet = { target_reps: "", target_weight_kg: "", target_rpe: "" };

function fromDetail(d: RoutineDetail): DraftExercise[] {
  return d.exercises.map((ex) => ({
    key: ex.id,
    exercise_id: ex.exercise_id,
    name: ex.exercise_name,
    muscle_group: ex.muscle_group,
    notes: ex.notes ?? "",
    sets: ex.sets.map((s) => ({
      target_reps: s.target_reps?.toString() ?? "",
      target_weight_kg: s.target_weight_kg?.toString() ?? "",
      target_rpe: s.target_rpe?.toString() ?? "",
    })),
  }));
}

const num = (v: string): number | null => {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * Builder de plantillas (plan §6.2, semanas 5-6). Reordenar con flechas;
 * TODO(UX): drag & drop con handle cuando entre una lib de dnd (post-MVP visual).
 */
export function RoutineBuilder({ routineId, initial }: Props) {
  const router = useRouter();
  const edit = Boolean(routineId);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [exercises, setExercises] = useState<DraftExercise[]>(initial ? fromDetail(initial) : []);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function addExercise(ex: Exercise) {
    setExercises((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        exercise_id: ex.id,
        name: ex.name,
        muscle_group: ex.muscle_group,
        notes: "",
        sets: [{ ...EMPTY_SET }, { ...EMPTY_SET }, { ...EMPTY_SET }],
      },
    ]);
    setPicking(false);
  }

  const mutateEx = (key: string, fn: (ex: DraftExercise) => DraftExercise) =>
    setExercises((prev) => prev.map((ex) => (ex.key === key ? fn(ex) : ex)));

  function move(key: string, dir: -1 | 1) {
    setExercises((prev) => {
      const i = prev.findIndex((e) => e.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function toPayload(): CreateRoutineInput | null {
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      exercises: exercises.map((ex, i) => ({
        exercise_id: ex.exercise_id,
        position: i + 1,
        notes: ex.notes.trim() || null,
        sets: ex.sets.map((s, j) => ({
          position: j + 1,
          target_reps: num(s.target_reps),
          target_weight_kg: num(s.target_weight_kg),
          target_rpe: num(s.target_rpe),
        })),
      })),
    };
    const parsed = CreateRoutineSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  }

  async function save() {
    setError(null);
    if (exercises.length === 0) {
      setError("Añade al menos un ejercicio a la rutina.");
      return;
    }
    const payload = toPayload();
    if (!payload) {
      setError("Revisa el nombre y los valores de las series (reps 1-100, RPE 1-10).");
      return;
    }
    setSaving(true);
    try {
      if (edit) {
        await api(`/routines/${routineId}`, { method: "PUT", body: payload });
      } else {
        await api("/routines", { method: "POST", body: payload });
      }
      router.replace("/entrenar");
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError && err.status === 422) {
        // Limite de plan FREE: copy sin culpa (plan §8.2)
        setError("Tu plan permite hasta 5 rutinas. Elimina una o pasa a PRO para crear más.");
      } else {
        setError("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
      }
    }
  }

  async function removeRoutine() {
    if (!routineId) return;
    setDeleting(true);
    try {
      await api(`/routines/${routineId}`, { method: "DELETE" });
      router.replace("/entrenar");
    } catch {
      setDeleting(false);
      setError("No se pudo eliminar. Inténtalo de nuevo.");
    }
  }

  const inputCls =
    "superficie texto-dato min-h-11 w-full rounded-[var(--radius-control)] px-2 text-center text-[var(--fg)]";

  return (
    <div className="flex flex-col gap-5 pb-24">
      <header className="flex items-center justify-between">
        <h1 className="texto-display text-xl text-[var(--fg)]">
          {edit ? "Editar rutina" : "Nueva rutina"}
        </h1>
        {edit && (
          <button
            type="button"
            onClick={removeRoutine}
            disabled={deleting}
            aria-label="Eliminar rutina"
            className="superficie flex h-10 w-10 items-center justify-center text-[var(--fg-muted)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--color-alerta)] hover:text-[var(--color-alerta)]"
          >
            <Trash2 size={16} strokeWidth={1.75} />
          </button>
        )}
      </header>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          Nombre
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="p. ej. Torso — Empuje"
            className="superficie min-h-11 rounded-[var(--radius-control)] px-3 text-[var(--fg)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          Descripción <span className="opacity-60">(opcional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="superficie min-h-11 rounded-[var(--radius-control)] px-3 text-[var(--fg)]"
          />
        </label>
      </div>

      {exercises.length === 0 && (
        <Card className="py-8 text-center text-sm text-[var(--fg-muted)]">
          La rutina está vacía. Añade el primer ejercicio abajo.
        </Card>
      )}

      <ul className="flex flex-col gap-4">
        {exercises.map((ex, i) => (
          <li key={ex.key}>
            <Card className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--fg)]">
                    <span className="texto-dato mr-2 text-[var(--fg-muted)]">{i + 1}</span>
                    {ex.name}
                  </p>
                  <p className="text-sm text-[var(--fg-muted)]">{MUSCLE_LABELS[ex.muscle_group]}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => move(ex.key, -1)}
                    disabled={i === 0}
                    aria-label={`Subir ${ex.name}`}
                    className="superficie flex h-9 w-9 items-center justify-center text-[var(--fg-muted)] disabled:opacity-30"
                  >
                    <ChevronUp size={16} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(ex.key, 1)}
                    disabled={i === exercises.length - 1}
                    aria-label={`Bajar ${ex.name}`}
                    className="superficie flex h-9 w-9 items-center justify-center text-[var(--fg-muted)] disabled:opacity-30"
                  >
                    <ChevronDown size={16} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExercises((prev) => prev.filter((e) => e.key !== ex.key))}
                    aria-label={`Quitar ${ex.name}`}
                    className="superficie flex h-9 w-9 items-center justify-center text-[var(--fg-muted)] hover:border-[var(--color-alerta)] hover:text-[var(--color-alerta)]"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Series objetivo */}
              <div
                className="grid items-center gap-2"
                style={{ gridTemplateColumns: "2rem 1fr 1fr 1fr 2.25rem" }}
              >
                <span />
                <span className="text-center text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                  Reps
                </span>
                <span className="text-center text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                  Kg
                </span>
                <span className="text-center text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                  RPE
                </span>
                <span />
                {ex.sets.map((s, j) => (
                  <SetRow
                    key={j}
                    index={j}
                    set={s}
                    canRemove={ex.sets.length > 1}
                    inputCls={inputCls}
                    onChange={(field, value) =>
                      mutateEx(ex.key, (e) => ({
                        ...e,
                        sets: e.sets.map((ss, jj) => (jj === j ? { ...ss, [field]: value } : ss)),
                      }))
                    }
                    onRemove={() =>
                      mutateEx(ex.key, (e) => ({ ...e, sets: e.sets.filter((_, jj) => jj !== j) }))
                    }
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => mutateEx(ex.key, (e) => ({ ...e, sets: [...e.sets, { ...EMPTY_SET }] }))}
                className="self-start text-sm text-[var(--fg-muted)] underline-offset-4 hover:text-[var(--fg)] hover:underline"
              >
                + Añadir serie
              </button>
            </Card>
          </li>
        ))}
      </ul>

      <Button variant="ghost" onClick={() => setPicking(true)}>
        <Plus size={16} strokeWidth={2} aria-hidden />
        Añadir ejercicio
      </Button>

      {error && <p className="text-sm text-[var(--color-alerta)]">{error}</p>}

      {/* Guardar fijo inferior (wireframe §6.2) */}
      <div
        className="vidrio fixed inset-x-0 bottom-14 z-30 px-4 py-3 lg:bottom-0 lg:left-56"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-2xl lg:max-w-[960px]">
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "Guardando…" : "Guardar rutina"}
          </Button>
        </div>
      </div>

      {picking && <ExercisePicker onSelect={addExercise} onClose={() => setPicking(false)} />}
    </div>
  );
}

function SetRow({
  index,
  set,
  canRemove,
  inputCls,
  onChange,
  onRemove,
}: {
  index: number;
  set: DraftSet;
  canRemove: boolean;
  inputCls: string;
  onChange: (field: keyof DraftSet, value: string) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <span className="texto-dato text-center text-sm text-[var(--fg-muted)]">{index + 1}</span>
      <input
        inputMode="numeric"
        value={set.target_reps}
        onChange={(e) => onChange("target_reps", e.target.value)}
        aria-label={`Serie ${index + 1}: repeticiones objetivo`}
        placeholder="–"
        className={inputCls}
      />
      <input
        inputMode="decimal"
        value={set.target_weight_kg}
        onChange={(e) => onChange("target_weight_kg", e.target.value)}
        aria-label={`Serie ${index + 1}: peso objetivo en kilogramos`}
        placeholder="–"
        className={inputCls}
      />
      <input
        inputMode="decimal"
        value={set.target_rpe}
        onChange={(e) => onChange("target_rpe", e.target.value)}
        aria-label={`Serie ${index + 1}: RPE objetivo`}
        placeholder="–"
        className={inputCls}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Quitar serie ${index + 1}`}
        className="flex h-9 w-9 items-center justify-center text-[var(--fg-muted)] disabled:opacity-30"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </>
  );
}
