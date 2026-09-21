"use client";

import { Check } from "lucide-react";

interface Props {
  index: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
  /** 'active' = serie en curso (steppers arriba la controlan); 'done' colapsa compacta; 'pending' aun no llega. */
  state: "active" | "done" | "pending";
  onComplete?: () => void;
}

const fmtKg = (kg: number) => (Number.isInteger(kg) ? kg.toString() : kg.toFixed(1));

/**
 * `SetRow` (plan §6.2): peso · reps · RPE · check. El componente mas usado de
 * la app — se colapsa a una linea compacta al completarse (§7: spring corto).
 */
export function SetRow({ index, weightKg, reps, rpe, state, onComplete }: Props) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 transition-colors duration-[var(--duration-fast)] ${
        state === "active" ? "superficie border-[var(--accent)]" : ""
      } ${state === "pending" ? "opacity-50" : ""}`}
    >
      <span className="texto-dato w-5 shrink-0 text-center text-sm text-[var(--fg-muted)]">{index + 1}</span>
      <span
        className={`texto-dato flex-1 text-sm ${state === "done" ? "text-[var(--fg-muted)]" : "text-[var(--fg)]"}`}
      >
        {weightKg > 0 ? `${fmtKg(weightKg)} kg` : "peso corporal"} × {reps || "–"}
        {rpe ? <span className="ml-2 text-xs text-[var(--fg-muted)]">RPE {rpe}</span> : null}
      </span>
      {state === "active" ? (
        <button
          type="button"
          onClick={onComplete}
          aria-label={`Completar serie ${index + 1}`}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--accent)] text-[var(--accent)] transition-colors duration-[var(--duration-fast)] hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
        >
          <Check size={16} strokeWidth={2.5} />
        </button>
      ) : state === "done" ? (
        <Check size={16} strokeWidth={2.5} className="shrink-0 text-[var(--positive)]" aria-hidden />
      ) : (
        <span className="w-14 shrink-0" aria-hidden />
      )}
    </div>
  );
}
