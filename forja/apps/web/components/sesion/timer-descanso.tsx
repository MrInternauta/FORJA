"use client";

import { useEffect, useState } from "react";

interface Props {
  /** Duracion inicial en segundos; cambia `resetKey` para reiniciar la cuenta. */
  initialSeconds: number;
  resetKey: number;
  onDone?: () => void;
}

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * `TimerDescanso` (plan §6.2/§7): cuenta regresiva display XXL. Un tap revela
 * ajustes rapidos (±15s); al llegar a 0 pulsa el display y dispara una
 * notificacion local — la recompensa de color se conserva con reduced-motion.
 */
export function TimerDescanso({ initialSeconds, resetKey, onDone }: Props) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [expanded, setExpanded] = useState(false);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [resetKey, initialSeconds]);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  useEffect(() => {
    if (seconds !== 0) return;
    navigator.vibrate?.(200);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Descanso terminado", { body: "Es hora de la siguiente serie.", tag: "forja-descanso" });
    }
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 1200);
    onDone?.();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds === 0]);

  const adjust = (delta: number) => setSeconds((s) => Math.max(0, s + delta));

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-label="Ajustar tiempo de descanso"
        className={`texto-dato text-3xl font-bold tabular-nums text-[var(--fg)] transition-transform ${
          pulsing ? "animar-latido text-[var(--accent)]" : ""
        }`}
        style={{ animationIterationCount: pulsing ? 3 : undefined }}
      >
        {fmt(seconds)}
      </button>
      {expanded && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => adjust(-15)}
            className="superficie flex h-9 items-center justify-center rounded-full px-3 text-sm text-[var(--fg-muted)]"
          >
            −15s
          </button>
          <button
            type="button"
            onClick={() => setSeconds(0)}
            className="superficie flex h-9 items-center justify-center rounded-full px-3 text-sm text-[var(--fg-muted)]"
          >
            Saltar
          </button>
          <button
            type="button"
            onClick={() => adjust(15)}
            className="superficie flex h-9 items-center justify-center rounded-full px-3 text-sm text-[var(--fg-muted)]"
          >
            +15s
          </button>
        </div>
      )}
    </div>
  );
}
