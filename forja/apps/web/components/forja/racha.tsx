import { Flame } from "lucide-react";

/** Chip de racha semanal (§8.1). Oro solo si la racha esta viva: se enciende con el merito. */
export function RachaChip({ weeks }: { weeks: number }) {
  const activa = weeks > 0;
  return (
    <span
      className={`superficie inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
        activa ? "border-[var(--accent)] text-[var(--accent)]" : "text-[var(--fg-muted)]"
      }`}
      title={`Racha: ${weeks} ${weeks === 1 ? "semana" : "semanas"}`}
    >
      <Flame size={15} strokeWidth={2} aria-hidden />
      {/* Sin esto el lector solo dice "1": el contexto lo da la llama, que es decorativa */}
      <span className="texto-dato" aria-hidden>
        {weeks}
      </span>
      <span className="sr-only">{`Racha de ${weeks} ${weeks === 1 ? "semana" : "semanas"}`}</span>
    </span>
  );
}
