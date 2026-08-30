import { AuthGate } from "@/components/auth/auth-gate";

/**
 * Layout de la sesion activa (plan §6.1): sin AppNav, pantalla completa en
 * todos los tamanos — "nada compite con el entrenamiento".
 */
export default function SesionLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-dvh bg-[var(--bg)]">{children}</div>
    </AuthGate>
  );
}
