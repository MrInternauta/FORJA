"use client";

import { useEffect, useRef, type RefObject } from "react";
import { isTopModal, layerOf, pushModal } from "./modal-stack";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamiento de dialogo modal accesible (WAI-ARIA APG):
 * - al abrir mueve el foco dentro (a `initialFocus` o al primer control),
 * - Tab / Shift+Tab quedan atrapados dentro,
 * - Escape cierra,
 * - al cerrar devuelve el foco a quien lo tenia,
 * - mientras está abierto, el resto de <body> queda `inert` (`modal-stack`).
 * `ref` va en el contenedor con `role="dialog"`, que debe vivir en un portal
 * sobre <body> (`Dialogo` ya lo hace): dentro de la página, la página entera
 * sería su capa y nada de atrás quedaría inert.
 */
export function useDialog<T extends HTMLElement>(
  onClose: () => void,
  initialFocus?: RefObject<HTMLElement | null>,
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    // El resto de la página queda inert mientras el diálogo esté abierto.
    const layer = layerOf(dialog);
    const closeLayer = pushModal(layer);

    const focusables = () => [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    const first = initialFocus?.current ?? focusables()[0];
    // Un control con autoFocus (p. ej. el buscador del picker) ya tiene el foco: se respeta.
    if (dialog.contains(document.activeElement)) {
      /* nada */
    } else if (first) first.focus();
    else {
      dialog.tabIndex = -1;
      dialog.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // Con diálogos apilados, solo el de arriba responde.
      if (!isTopModal(layer)) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === a || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && (document.activeElement === z || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        a.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Primero se quita el inert: un elemento inert no puede recibir el foco.
      closeLayer();
      // Devolver el foco solo si sigue existiendo en el documento.
      if (previous && document.contains(previous)) previous.focus();
    };
    // initialFocus es una ref estable; montar/desmontar es lo que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
