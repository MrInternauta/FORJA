/**
 * Pila de capas modales abiertas. Mientras haya alguna, todo hijo directo de
 * <body> que no sea la capa de arriba queda `inert`: fuera del árbol de
 * accesibilidad y sin foco ni clics. Es lo que impide que VoiceOver o TalkBack
 * lleguen a la página de atrás deslizando (no usan Tab, así que atrapar Tab no
 * basta, y `aria-modal` no lo respetan todos los lectores).
 *
 * Solo se toca lo que la pila marcó: un `inert` puesto por otro código se respeta.
 */
const stack: HTMLElement[] = [];
const marked = new Set<HTMLElement>();

function sync() {
  const top = stack[stack.length - 1];
  for (const el of marked) {
    if (!el.isConnected) marked.delete(el);
  }
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue;
    const shouldBeInert = top !== undefined && child !== top;
    if (shouldBeInert && !child.inert) {
      child.inert = true;
      marked.add(child);
    } else if (!shouldBeInert && marked.has(child)) {
      child.inert = false;
      marked.delete(child);
    }
  }
}

/** Abre una capa (un hijo directo de <body>). Devuelve la función que la cierra. */
export function pushModal(layer: HTMLElement): () => void {
  stack.push(layer);
  sync();
  return () => {
    const i = stack.lastIndexOf(layer);
    if (i !== -1) stack.splice(i, 1);
    sync();
  };
}

/** ¿Es la capa de arriba? Solo esa atiende Escape y atrapa Tab. */
export function isTopModal(layer: HTMLElement): boolean {
  return stack[stack.length - 1] === layer;
}

/** El hijo directo de <body> que contiene a `el` (la capa del portal). */
export function layerOf(el: HTMLElement): HTMLElement {
  let node = el;
  while (node.parentElement && node.parentElement !== document.body) node = node.parentElement;
  return node;
}
