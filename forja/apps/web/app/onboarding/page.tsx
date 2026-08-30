"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingSchema } from "@forja/shared";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

/** Primer login: crea profiles + user_stats (arquitectura §5, paso 3). */
export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = OnboardingSchema.safeParse({
      username: username.trim().toLowerCase(),
      display_name: displayName.trim() || undefined,
    });
    if (!parsed.success) {
      setError("El usuario debe tener 3-30 caracteres: minúsculas, números o guion bajo.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/onboarding", { method: "POST", body: parsed.data });
      router.replace("/hoy");
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError && err.status === 409) {
        setError("Ese nombre de usuario ya está en uso. Prueba otro.");
      } else if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
      } else {
        setError("No se pudo crear el perfil. Revisa tu conexión e inténtalo de nuevo.");
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="texto-display text-3xl text-[var(--fg)]">Un último golpe</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Elige el nombre con el que se firmará tu progreso.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          Nombre de usuario
          <input
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="p. ej. ana_fierro"
            className="superficie texto-dato min-h-11 rounded-[var(--radius-control)] px-3 lowercase text-[var(--fg)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          Nombre visible <span className="opacity-60">(opcional)</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ana Fierro"
            className="superficie min-h-11 rounded-[var(--radius-control)] px-3 text-[var(--fg)]"
          />
        </label>

        {error && <p className="text-sm text-[var(--color-alerta)]">{error}</p>}

        <Button type="submit" disabled={loading}>
          {loading ? "Forjando…" : "Empezar"}
        </Button>
      </form>
    </main>
  );
}
