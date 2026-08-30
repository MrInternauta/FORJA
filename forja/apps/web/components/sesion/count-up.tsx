"use client";

import { useEffect, useState } from "react";

interface Props {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
  delayMs?: number;
}

/** Count-up de cierre de sesion (plan §7): "recompensa de cierre", 200ms/valor aprox. */
export function CountUp({ value, durationMs = 700, format, delayMs = 0 }: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    let start = 0;
    const startTimer = setTimeout(() => {
      const step = (t: number) => {
        if (!start) start = t;
        const p = Math.min(1, (t - start) / durationMs);
        setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delayMs);
    return () => {
      clearTimeout(startTimer);
      cancelAnimationFrame(raf);
    };
  }, [value, durationMs, delayMs]);

  return <>{format ? format(display) : display}</>;
}
