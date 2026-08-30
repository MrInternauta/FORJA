import { AppNav } from "@/components/nav/app-nav";
import { AuthGate } from "@/components/auth/auth-gate";
import { SesionPildora } from "@/components/sesion/sesion-pildora";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-dvh">
        <AppNav />
        {/* pb: espacio para la tab bar movil; lg: hueco de sidebar y ancho maximo (§6.1) */}
        <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 lg:max-w-[960px] lg:pl-64 lg:pt-10">
          {children}
        </main>
        <SesionPildora />
      </div>
    </AuthGate>
  );
}
