"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Login/registro contra Supabase Auth (arquitectura §5, paso 1). */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = getSupabase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const fn =
      mode === "login"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error: err } = await fn;
    setLoading(false);
    if (err) {
      setError(
        mode === "login"
          ? "Correo o contraseña incorrectos."
          : "No se pudo crear la cuenta. Revisa el correo e inténtalo de nuevo.",
      );
      return;
    }
    router.push("/hoy");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="texto-display text-center text-3xl text-[var(--fg)]">Forja</h1>

      {!supabase ? (
        <Card className="text-sm text-[var(--fg-muted)]">
          Falta configurar <code className="texto-dato">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
          <code className="texto-dato">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (ver .env.example).
        </Card>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
            Correo
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="superficie min-h-11 rounded-[var(--radius-control)] px-3 text-[var(--fg)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
            Contraseña
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="superficie min-h-11 rounded-[var(--radius-control)] px-3 text-[var(--fg)]"
            />
          </label>

          {error && <p className="text-sm text-[var(--color-alerta)]">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-sm text-[var(--fg-muted)] underline-offset-4 hover:text-[var(--fg)] hover:underline"
          >
            {mode === "login" ? "Crear una cuenta nueva" : "Ya tengo cuenta"}
          </button>
        </form>
      )}
    </main>
  );
}
