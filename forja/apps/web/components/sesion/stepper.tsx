"use client";

import { useRef } from "react";
import { Minus, Plus } from "lucide-react";

interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  step: number;
  min?: number;
  max?: number;
  format?: (value: number) => string;
  label: string;
}

const HOLD_DELAY_MS = 400;
const MIN_REPEAT_MS = 60;

/**
 * `StepperPeso` / `StepperReps` (plan §6.2): botones de 56px con press-and-hold
 * acelerado. Un tap corto = un paso; mantener presionado repite acelerando.
 */
export function Stepper({ value, onChange, step, min = 0, max = Infinity, format, label }: StepperProps) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdingRef = useRef(false);

  const clear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const apply = (dir: 1 | -1) => {
    const next = Math.min(max, Math.max(min, Math.round((valueRef.current + dir * step) * 100) / 100));
    valueRef.current = next;
    onChange(next);
  };

  const repeat = (dir: 1 | -1, delay: number) => {
    apply(dir);
    timerRef.current = setTimeout(() => repeat(dir, Math.max(MIN_REPEAT_MS, delay * 0.7)), delay);
  };

  const onPointerDown = (dir: 1 | -1) => {
    holdingRef.current = false;
    clear();
    timerRef.current = setTimeout(() => {
      holdingRef.current = true;
      repeat(dir, 350);
    }, HOLD_DELAY_MS);
  };

  const onClick = (dir: 1 | -1) => {
    if (holdingRef.current) {
      holdingRef.current = false;
      return; // el hold ya aplico el ultimo paso
    }
    apply(dir);
  };

  const btnCls =
    "superficie flex h-14 w-14 shrink-0 select-none items-center justify-center text-[var(--fg)] transition-colors duration-[var(--duration-fast)] active:border-[var(--accent)] active:text-[var(--accent)] disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label={`Disminuir ${label}`}
        disabled={value <= min}
        className={btnCls}
        onPointerDown={() => onPointerDown(-1)}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onClick={() => onClick(-1)}
      >
        <Minus size={20} strokeWidth={2.5} />
      </button>
      <span className="texto-dato min-w-[4.5rem] text-center text-2xl font-bold text-[var(--fg)]" aria-live="polite">
        {format ? format(value) : value}
      </span>
      <button
        type="button"
        aria-label={`Aumentar ${label}`}
        disabled={value >= max}
        className={btnCls}
        onPointerDown={() => onPointerDown(1)}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onClick={() => onClick(1)}
      >
        <Plus size={20} strokeWidth={2.5} />
      </button>
    </div>
  );
}
