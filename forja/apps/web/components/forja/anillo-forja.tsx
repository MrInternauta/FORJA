"use client";

import { useId } from "react";

interface AnilloForjaProps {
  /** Progreso actual (p. ej. sesiones completadas de la semana). */
  value: number;
  max: number;
  size?: number;
  /** true al completar objetivo o romper PR: el trazo "igniciona" a oro->brasa. */
  ignited?: boolean;
  children?: React.ReactNode;
  label?: string;
}

/**
 * Firma visual FORJA (plan de diseno §1): anillo de progreso metalico.
 * Es el UNICO elemento de la UI con gradiente, y solo cuando `ignited`.
 * El avance anima con --ease-forja; reduced-motion lo resuelve globals.css.
 */
export function AnilloForja({ value, max, size = 168, ignited = false, children, label }: AnilloForjaProps) {
  const gradId = useId();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = Math.min(Math.max(max > 0 ? value / max : 0, 0), 1);

  return (
    <div
      role="img"
      aria-label={label ?? `Progreso: ${value} de ${max}`}
      className={`relative inline-flex items-center justify-center ${ignited ? "animar-ignicion" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--ignicion-desde)" />
            <stop offset="100%" stopColor="var(--ignicion-hasta)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ignited ? `url(#${gradId})` : "var(--fg-muted)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: "stroke-dashoffset 400ms var(--ease-forja), stroke 400ms var(--ease-forja)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
