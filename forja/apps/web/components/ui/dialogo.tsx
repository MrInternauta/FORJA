"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useDialog } from "@/lib/a11y/use-dialog";

/**
 * Capa modal accesible: `role="dialog"` + foco dentro, Tab atrapado, Escape
 * cierra y el foco vuelve al disparador (`useDialog`). Clic en el fondo cierra.
 */
export function Dialogo({
  label,
  onClose,
  children,
  ...props
}: { label: string; onClose: () => void; children: ReactNode } & Omit<HTMLAttributes<HTMLDivElement>, "onClick">) {
  const ref = useDialog<HTMLDivElement>(onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={label} onClick={onClose} {...props}>
      {children}
    </div>
  );
}
