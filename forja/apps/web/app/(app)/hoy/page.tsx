"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import type { RoutineSummary } from "@forja/shared";
import { AnilloForja } from "@/components/forja/anillo-forja";
import { RachaChip } from "@/components/forja/racha";
import { Card } from "@/components/ui/card";
import { useMe } from "@/components/auth/auth-gate";
import { api } from "@/lib/api";
import { localDb } from "@/lib/offline/db";

interface WorkoutListItem {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  volume_kg: number;
  sets_completed: number;
}

/**
 * Red primero; si falla (offline) o para sesiones recien terminadas que aun no
 * sincronizan, se completa con Dexie (arquitectura §6 — logger sem. 7-9).
 */
async function loadWorkouts(): Promise<WorkoutListItem[]> {
  let networkItems: WorkoutListItem[] = [];
  try {
    const res = await api<{ items: WorkoutListItem[] }>("/workouts");
    networkItems = res.items;
  } catch {
    /* offline: seguimos solo con lo local */
  }

  const local = await localDb.workouts.toArray();
  const localFinished = local.filter((w) => w.ended_at && w.sync_status === "pending");
  const localMapped: WorkoutListItem[] = localFinished.map((w) => {
    const sets = w.exercises.flatMap((ex) => ex.sets).filter((st) => st.is_completed);
    return {
      id: w.id,
      title: w.title,
      started_at: w.started_at,
      ended_at: w.ended_at ?? null,
      duration_seconds: w.ended_at
        ? Math.round((new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 1000)
        : null,
      volume_kg: sets.reduce((sum, st) => sum + st.weight_kg * st.reps, 0),
      sets_completed: sets.length,
    };
  });

  const merged = new Map<string, WorkoutListItem>();
  for (const item of networkItems) merged.set(item.id, item);
  for (const item of localMapped) if (!merged.has(item.id)) merged.set(item.id, item);
  return [...merged.values()].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );
}

/** Lunes 00:00 de la semana actual (misma convencion ISO que el backend). */
function startOfWeek(): Date {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - (day - 1));
  return monday;
}

export default function HoyPage() {
  const { stats } = useMe();
  const [workouts, setWorkouts] = useState<WorkoutListItem[] | null>(null);
  const [suggested, setSuggested] = useState<RoutineSummary | null>(null);

  useEffect(() => {
    loadWorkouts().then(setWorkouts);
    api<{ items: RoutineSummary[] }>("/routines")
      .then((res) => setSuggested(res.items[0] ?? null))
      .catch(() => setSuggested(null));
  }, []);

  const fecha = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const sessionsThisWeek = useMemo(() => {
    if (!workouts) return 0;
    const monday = startOfWeek().getTime();
    return workouts.filter((w) => w.ended_at && new Date(w.started_at).getTime() >= monday).length;
  }, [workouts]);

  const last = workouts?.find((w) => w.ended_at) ?? null;
  const restantes = Math.max(stats.weekly_goal - sessionsThisWeek, 0);
  const cumplido = restantes === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="texto-display text-xl text-[var(--fg)]">{fecha}</h1>
        <RachaChip weeks={stats.current_streak} />
      </header>

      {/* Objetivo semanal: la firma visual preside la pantalla */}
      <Card className="flex flex-col items-center gap-4 py-8">
        <AnilloForja
          value={sessionsThisWeek}
          max={stats.weekly_goal}
          ignited={cumplido && sessionsThisWeek > 0}
          label={`Sesiones de la semana: ${sessionsThisWeek} de ${stats.weekly_goal}`}
        >
          <span className="texto-dato text-4xl font-bold text-[var(--fg)]">
            {workouts === null ? "–" : sessionsThisWeek}
            <span className="text-[var(--fg-muted)]">/{stats.weekly_goal}</span>
          </span>
          <span className="mt-1 text-xs uppercase tracking-wide text-[var(--fg-muted)]">
            sesiones
          </span>
        </AnilloForja>
        <p className="text-sm text-[var(--fg-muted)]">
          {workouts === null
            ? "Cargando tu semana…"
            : cumplido && sessionsThisWeek > 0
              ? "Semana cumplida. La racha sigue viva."
              : `${restantes} ${restantes === 1 ? "sesión" : "sesiones"} para cerrar la semana`}
        </p>
      </Card>

      {/* CTA principal: unico boton oro de la pantalla */}
      <div className="flex flex-col items-center gap-2">
        <Link
          href={suggested ? `/sesion?routine=${suggested.id}` : "/sesion"}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-5 font-semibold text-[var(--accent-contrast)] transition-[filter] duration-[var(--duration-fast)] hover:brightness-110"
        >
          <Play size={18} strokeWidth={2.25} aria-hidden />
          {suggested ? `Empezar: ${suggested.name}` : "Empezar entrenamiento"}
        </Link>
        {suggested && (
          <Link href="/entrenar" className="inline-flex min-h-11 items-center px-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
            o elige otra rutina / libre
          </Link>
        )}
      </div>

      <section aria-labelledby="ultima-sesion">
        <h2
          id="ultima-sesion"
          className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]"
        >
          Última sesión
        </h2>
        {last ? (
          <Card className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-[var(--fg)]">{last.title}</p>
              <p className="text-sm text-[var(--fg-muted)]">
                {new Intl.DateTimeFormat("es-MX", { weekday: "long" }).format(
                  new Date(last.started_at),
                )}
                {last.duration_seconds ? ` · ${Math.round(last.duration_seconds / 60)} min` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="texto-dato text-lg font-bold text-[var(--fg)]">
                {Math.round(last.volume_kg).toLocaleString("es-MX")} kg
              </p>
              <p className="text-sm text-[var(--fg-muted)]">{last.sets_completed} series</p>
            </div>
          </Card>
        ) : (
          <Card className="text-sm text-[var(--fg-muted)]">
            {workouts === null
              ? "Cargando…"
              : "Aún no hay entrenamientos. El primero se registra arriba."}
          </Card>
        )}
      </section>
    </div>
  );
}
