/**
 * Aviso de fin de descanso desde el Service Worker: la pagina programa una
 * hora limite y el SW notifica solo si para entonces no hay cliente visible.
 * Chrome corta los eventos extendibles a ~5 min: descansos mas largos pueden
 * no avisar en segundo plano (el timer sigue siendo correcto al volver).
 */

export const DESCANSO_MESSAGE = "forja-descanso";
export const DESCANSO_CANCEL_MESSAGE = "forja-descanso-cancelar";

export interface DescansoDeps {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  hayClienteVisible(): Promise<boolean>;
  mostrar(): Promise<void>;
}

export function crearProgramadorDescanso(deps: DescansoDeps): {
  programar(endsAt: number): Promise<void>;
  cancelar(): void;
} {
  let pendiente: { id: unknown; resolve: () => void } | null = null;

  function limpiar() {
    if (!pendiente) return;
    deps.clearTimeout(pendiente.id);
    pendiente.resolve();
    pendiente = null;
  }

  function programar(endsAt: number): Promise<void> {
    limpiar();
    const disparar = async () => {
      if (!(await deps.hayClienteVisible())) await deps.mostrar();
    };
    if (endsAt <= deps.now()) return disparar();
    return new Promise<void>((resolve) => {
      const id = deps.setTimeout(() => {
        pendiente = null;
        void disparar().then(resolve, resolve);
      }, endsAt - deps.now());
      pendiente = { id, resolve };
    });
  }

  function cancelar(): void {
    limpiar();
  }

  return { programar, cancelar };
}
