/** Mueve el elemento de `from` a `to` (índices sobre el arreglo original). Devuelve el mismo arreglo si no cambia nada o los índices son inválidos. */
export function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
    return arr as T[];
  }
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Índice destino del elemento arrastrado: cuántos de los OTROS elementos (en orden, sin el arrastrado) tienen su punto medio por encima de `y`. */
export function targetIndex(otherMidpoints: readonly number[], y: number): number {
  let i = 0;
  while (i < otherMidpoints.length && otherMidpoints[i] < y) i++;
  return i;
}
