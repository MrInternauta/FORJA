"use client";

import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "@/lib/a11y/use-dialog";

type Props = { label: string; onClose: () => void; children: ReactNode } & Omit<
  HTMLAttributes<HTMLDivElement>,
  "onClick"
>;

/**
 * Capa modal accesible: `role="dialog"` + foco dentro, Tab atrapado, Escape
 * cierra y el foco vuelve al disparador (`useDialog`). Clic en el fondo cierra.
 *
 * Se monta en un portal, en una capa propia sobre <body>, para que el resto de
 * la página pueda quedar `inert` mientras está abierta: así VoiceOver y TalkBack
 * no llegan a lo de atrás deslizando.
 */
export function Dialogo(props: Props) {
  const [capa, setCapa] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.dataset.capa = "dialogo";
    document.body.appendChild(el);
    setCapa(el);
    return () => el.remove();
  }, []);

  return capa ? createPortal(<Panel {...props} />, capa) : null;
}

function Panel({ label, onClose, children, ...props }: Props) {
  const ref = useDialog<HTMLDivElement>(onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={label} onClick={onClose} {...props}>
      {children}
    </div>
  );
}
