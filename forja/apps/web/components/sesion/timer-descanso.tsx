"use client";

import { useEffect, useRef, useState } from "react";
import { ajustar, restante } from "@/lib/sesion/descanso";
import {
  avisoDescansoSinSw,
  cancelarAvisoDescanso,
  programarAvisoDescanso,
} from "@/lib/sesion/descanso-notificacion";

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
 * `TimerDescanso` (plan §6.2/§7): cuenta regresiva display XXL contra una hora
 * limite — el tiempo sigue siendo correcto con la pestana oculta o throttled.
 * Un tap revela ajustes rapidos (±15s); al llegar a 0 pulsa el display y el
 * aviso lo emite el Service Worker (o la pagina si no hay SW). La recompensa
 * de color se conserva con reduced-motion.
 */
export function TimerDescanso({ initialSeconds, resetKey, onDone }: Props) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + initialSeconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  // La celebracion (vibrar, pulso, onDone) se dispara una sola vez por deadline.
  const firedFor = useRef<number | null>(null);
  const seconds = restante(endsAt, now);

  useEffect(() => {
    setEndsAt(Date.now() + initialSeconds * 1000);
    setNow(Date.now());
  }, [resetKey, initialSeconds]);

  // La pagina solo programa la hora; el SW decide si notificar al vencer.
  useEffect(() => {
    if (endsAt > Date.now()) programarAvisoDescanso(endsAt);
    else cancelarAvisoDescanso();
    return cancelarAvisoDescanso;
  }, [endsAt]);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    const onVisibility = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, seconds > 0]);

  useEffect(() => {
    if (seconds !== 0 || firedFor.current === endsAt) return;
    firedFor.current = endsAt;
    navigator.vibrate?.(200);
    if (!navigator.serviceWorker?.controller) void avisoDescansoSinSw();
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 1200);
    onDone?.();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds === 0, endsAt]);

  const adjust = (delta: number) => setEndsAt((e) => ajustar(e, Date.now(), delta));
  const skip = () => {
    cancelarAvisoDescanso();
    setEndsAt(Date.now());
  };

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
            className="superficie flex h-14 min-w-14 items-center justify-center rounded-full px-4 text-sm text-[var(--fg-muted)]"
          >
            −15s
          </button>
          <button
            type="button"
            onClick={skip}
            className="superficie flex h-14 min-w-14 items-center justify-center rounded-full px-4 text-sm text-[var(--fg-muted)]"
          >
            Saltar
          </button>
          <button
            type="button"
            onClick={() => adjust(15)}
            className="superficie flex h-14 min-w-14 items-center justify-center rounded-full px-4 text-sm text-[var(--fg-muted)]"
          >
            +15s
          </button>
        </div>
      )}
    </div>
  );
}
