"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile, UserStats } from "@forja/shared";
import { api, ApiError } from "@/lib/api";
import { getSupabase } from "@/lib/supabase/client";
import { registerSyncTriggers } from "@/lib/offline/sync";
import { Card } from "@/components/ui/card";

interface MeContextValue {
  profile: Profile;
  stats: UserStats;
  refreshMe: () => Promise<void>;
}

const MeContext = createContext<MeContextValue | null>(null);

/** Datos del usuario autenticado, disponibles en cualquier pantalla del shell. */
export function useMe(): MeContextValue {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe debe usarse dentro de <AuthGate>");
  return ctx;
}

type GateState =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "ready"; profile: Profile; stats: UserStats };

/**
 * Guardia del shell (arquitectura §5):
 * - Sin sesion de Supabase -> /login.
 * - Con sesion pero sin perfil (GET /me = 404) -> /onboarding.
 * - Con perfil -> expone { profile, stats } via useMe().
 * Tambien escucha SIGNED_OUT para expulsar al instante.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GateState>({ status: "loading" });

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setState({ status: "unconfigured" });
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    try {
      const me = await api<{ profile: Profile; stats: UserStats }>("/me");
      setState({ status: "ready", profile: me.profile, stats: me.stats });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        router.replace("/onboarding");
        return;
      }
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      throw err;
    }
  }, [router]);

  useEffect(() => {
    void load();
    const supabase = getSupabase();
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => subscription.unsubscribe();
  }, [load, router]);

  /** Flush del outbox al reconectar/abrir (arquitectura §6): refresca stats si trae recompensas. */
  useEffect(() => {
    if (state.status !== "ready") return;
    return registerSyncTriggers(() => void load());
  }, [state.status, load]);

  if (state.status === "unconfigured") {
    return (
      <main className="mx-auto max-w-sm px-4 pt-24">
        <Card className="text-sm text-[var(--fg-muted)]">
          Falta configurar <code className="texto-dato">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
          <code className="texto-dato">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (ver .env.example).
        </Card>
      </main>
    );
  }

  if (state.status === "loading") {
    // Splash minimo: wordmark, sin spinner a pantalla completa (plan §6.3).
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <span className="texto-display animate-pulse text-3xl text-[var(--fg-muted)]">Forja</span>
      </main>
    );
  }

  return (
    <MeContext.Provider
      value={{ profile: state.profile, stats: state.stats, refreshMe: load }}
    >
      {children}
    </MeContext.Provider>
  );
}
