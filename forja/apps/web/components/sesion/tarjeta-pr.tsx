"use client";

import { useEffect, useState } from "react";
import { Flame, Share2 } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";

interface Props {
  exerciseName: string;
  weightKg: number;
  reps: number;
  onClose: () => void;
}

const fmtKg = (kg: number) => (Number.isInteger(kg) ? kg.toString() : kg.toFixed(1));

/**
 * `TarjetaPR` (plan §7/§8): el unico momento maximalista de la app — el
 * trazo funde de acero a gradiente oro->brasa. Con `prefers-reduced-motion`
 * se omiten las chispas pero se conserva el color de logro (regla dura §7).
 */
export function TarjetaPR({ exerciseName, weightKg, reps, onClose }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const share = () => {
    void navigator.share?.({
      title: "Nuevo PR en FORJA",
      text: `Nuevo récord en ${exerciseName}: ${fmtKg(weightKg)} kg × ${reps} 🔥`,
    }).catch(() => {});
  };

  return (
    <Dialogo
      label="Nuevo récord personal"
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`superficie relative flex w-full max-w-sm flex-col items-center gap-3 overflow-hidden border-[var(--accent)] p-8 text-center ${
          reducedMotion ? "" : "animar-ignicion"
        }`}
      >
        {!reducedMotion && <Chispas />}
        <span className="texto-display text-sm tracking-widest text-[var(--accent)]">
          RÉCORD PERSONAL
        </span>
        <Flame size={40} strokeWidth={1.5} className="text-[var(--ignicion-hasta)]" aria-hidden />
        <p className="texto-display text-lg text-[var(--fg)]">{exerciseName}</p>
        <p
          className="texto-dato text-5xl font-bold"
          style={{
            backgroundImage: "linear-gradient(135deg, var(--ignicion-desde), var(--ignicion-hasta))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {fmtKg(weightKg)} <span className="text-2xl">kg</span>
        </p>
        <p className="text-sm text-[var(--fg-muted)]">{reps} repeticiones</p>
        <div className="mt-2 flex w-full gap-2">
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              type="button"
              onClick={share}
              className="superficie flex min-h-11 flex-1 items-center justify-center gap-2 text-sm text-[var(--fg)]"
            >
              <Share2 size={16} strokeWidth={1.75} aria-hidden />
              Compartir
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-semibold text-[var(--accent-contrast)]"
          >
            Continuar
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

function Chispas() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: 7 }).map((_, i) => (
        <span
          key={i}
          className="absolute bottom-0 h-1.5 w-1.5 rounded-full bg-[var(--color-oro)]"
          style={{ left: `${10 + i * 12}%`, animation: `chispa 900ms var(--ease-forja) ${i * 60}ms 1` }}
        />
      ))}
    </div>
  );
}
