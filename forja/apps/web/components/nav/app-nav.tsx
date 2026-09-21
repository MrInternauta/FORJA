"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Flame, TrendingUp, User } from "lucide-react";

const ITEMS = [
  { href: "/hoy", label: "Hoy", icon: Flame },
  { href: "/entrenar", label: "Entrenar", icon: Dumbbell },
  { href: "/progreso", label: "Progreso", icon: TrendingUp },
  { href: "/perfil", label: "Perfil", icon: User },
] as const;

/**
 * Navegacion responsive (plan de diseno §6.1):
 * - < lg: bottom tab bar translucida (vidrio), objetivos tactiles >= 44px.
 * - >= lg: sidebar fija a la izquierda.
 * (Feed se anade como 5a entrada en Fase 2.)
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Tab bar movil */}
      <nav
        aria-label="Principal"
        className="vidrio fixed inset-x-0 bottom-0 z-40 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-around">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] transition-colors duration-[var(--duration-fast)] ${
                    active ? "text-[var(--accent)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sidebar escritorio */}
      <nav
        aria-label="Principal"
        className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-4 lg:flex"
      >
        <Link href="/hoy" className="texto-display mb-8 flex min-h-11 items-center px-2 text-xl text-[var(--fg)]">
          Forja
        </Link>
        <ul className="flex flex-col gap-1">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm transition-colors duration-[var(--duration-fast)] ${
                    active
                      ? // Texto en --fg: el oro sobre su propio tinte bajaba a 4.2:1 en claro; el icono lleva el oro
                        "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-semibold text-[var(--fg)] [&>svg]:text-[var(--accent)]"
                      : "text-[var(--fg-muted)] hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] hover:text-[var(--fg)]"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
