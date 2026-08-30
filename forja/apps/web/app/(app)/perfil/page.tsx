"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Minus, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMe } from "@/components/auth/auth-gate";
import { api } from "@/lib/api";
import { getSupabase } from "@/lib/supabase/client";

const ROLE_LABEL = { ADMIN: "Admin", PRO: "PRO", FREE: "Free" } as const;

export default function PerfilPage() {
  const router = useRouter();
  const { profile, stats, refreshMe } = useMe();
  const [goal, setGoal] = useState(stats.weekly_goal);
  const [saving, setSaving] = useState(false);
  const [publico, setPublico] = useState(profile.is_public);

  async function saveGoal(next: number) {
    const clamped = Math.min(Math.max(next, 1), 7);
    if (clamped === goal) return;
    setGoal(clamped); // optimista
    setSaving(true);
    try {
      await api("/me", { method: "PATCH", body: { weekly_goal: clamped } });
      await refreshMe();
    } catch {
      setGoal(goal); // revertir
    } finally {
      setSaving(false);
    }
  }

  async function togglePublico() {
    const next = !publico;
    setPublico(next); // optimista
    try {
      await api("/me", { method: "PATCH", body: { is_public: next } });
      await refreshMe();
    } catch {
      setPublico(!next);
    }
  }

  async function logout() {
    await getSupabase()?.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="texto-display text-xl text-[var(--fg)]">Perfil</h1>

      <Card className="flex items-center gap-4">
        <div
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)]"
        >
          <span className="texto-display text-lg text-[var(--fg-muted)]">
            {(profile.display_name ?? profile.username).charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[var(--fg)]">
            {profile.display_name ?? profile.username}
          </p>
          <p className="texto-dato truncate text-sm text-[var(--fg-muted)]">@{profile.username}</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
            profile.role === "FREE"
              ? "border-[var(--border)] text-[var(--fg-muted)]"
              : "border-[var(--accent)] text-[var(--accent)]"
          }`}
        >
          {ROLE_LABEL[profile.role]}
        </span>
      </Card>

      <section aria-labelledby="objetivo">
        <h2
          id="objetivo"
          className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]"
        >
          Objetivo semanal
        </h2>
        <Card className="flex items-center justify-between">
          <p className="text-sm text-[var(--fg-muted)]">
            Sesiones por semana para mantener la racha
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => saveGoal(goal - 1)}
              disabled={saving || goal <= 1}
              aria-label="Reducir objetivo"
              className="superficie flex h-11 w-11 items-center justify-center text-[var(--fg)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--accent)] disabled:opacity-40"
            >
              <Minus size={16} strokeWidth={2} />
            </button>
            <span className="texto-dato w-6 text-center text-xl font-bold text-[var(--fg)]">
              {goal}
            </span>
            <button
              type="button"
              onClick={() => saveGoal(goal + 1)}
              disabled={saving || goal >= 7}
              aria-label="Aumentar objetivo"
              className="superficie flex h-11 w-11 items-center justify-center text-[var(--fg)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--accent)] disabled:opacity-40"
            >
              <Plus size={16} strokeWidth={2} />
            </button>
          </div>
        </Card>
      </section>

      <section aria-labelledby="privacidad">
        <h2
          id="privacidad"
          className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]"
        >
          Privacidad
        </h2>
        <Card className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--fg)]">Perfil público</p>
            <p className="text-xs text-[var(--fg-muted)]">
              Otros podrán ver tu perfil y lo que publiques. Nada se publica solo.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={publico}
            onClick={togglePublico}
            className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-[var(--duration-fast)] ${
              publico ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--bg)]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-[22px] w-[22px] rounded-full bg-[var(--fg)] transition-[left] duration-[var(--duration-fast)] ${
                publico ? "left-[24px] bg-[var(--accent-contrast)]" : "left-0.5"
              }`}
            />
          </button>
        </Card>
      </section>

      <section aria-labelledby="ajustes">
        <h2
          id="ajustes"
          className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]"
        >
          Apariencia
        </h2>
        <ThemeToggle />
      </section>

      <div>
        <Button variant="ghost" onClick={logout}>
          <LogOut size={16} strokeWidth={1.75} aria-hidden />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
