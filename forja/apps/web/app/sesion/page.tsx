"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { Exercise, SyncResponse } from "@forja/shared";
import { ExercisePicker } from "@/components/rutinas/exercise-picker";
import { CountUp } from "@/components/sesion/count-up";
import { SetRow } from "@/components/sesion/set-row";
import { Stepper } from "@/components/sesion/stepper";
import { TarjetaPR } from "@/components/sesion/tarjeta-pr";
import { TimerDescanso } from "@/components/sesion/timer-descanso";
import {
  type DraftExercise,
  type DraftSet,
  type SessionSummary,
  useActiveSession,
} from "@/components/sesion/use-active-session";

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

const fmtKg = (kg: number) => (Number.isInteger(kg) ? kg.toString() : kg.toFixed(1));
const fmtClock = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function SesionPage() {
  return (
    <Suspense fallback={<FullScreenMessage>Preparando tu sesión…</FullScreenMessage>}>
      <SesionInner />
    </Suspense>
  );
}

function SesionInner() {
  const router = useRouter();
  const params = useSearchParams();
  const routineId = params.get("routine") ?? undefined;
  const resumeId = params.get("resume") ?? undefined;

  const session = useActiveSession({ routineId, resumeId });
  const [picking, setPicking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finishResult, setFinishResult] = useState<{
    rewards: SyncResponse["rewards"] | null;
    summary: SessionSummary;
  } | null>(null);
  const [prQueue, setPrQueue] = useState<SyncResponse["rewards"]["new_prs"]>([]);

  const s = session.state;

  useEffect(() => {
    if (session.redirectTo) router.replace(session.redirectTo);
  }, [session.redirectTo, router]);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!s) return;
    const startedAtMs = new Date(s.startedAt).getTime();
    setElapsed(Math.round((Date.now() - startedAtMs) / 1000));
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAtMs) / 1000)), 1000);
    return () => clearInterval(id);
  }, [s?.startedAt]);

  if (session.redirectTo) return null;
  if (session.status === "loading") return <FullScreenMessage>Preparando tu sesión…</FullScreenMessage>;
  if (session.status === "error") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[var(--fg-muted)]">No se pudo cargar la sesión.</p>
        <button
          type="button"
          onClick={() => router.replace("/entrenar")}
          className="text-sm text-[var(--accent)] underline underline-offset-4"
        >
          Volver a Entrenar
        </button>
      </main>
    );
  }
  if (session.status === "finishing" && !finishResult) {
    return <FullScreenMessage>Guardando tu entrenamiento…</FullScreenMessage>;
  }

  if (finishResult) {
    return (
      <ResumenSesion
        summary={finishResult.summary}
        rewards={finishResult.rewards}
        prQueue={prQueue}
        onDismissPr={() => setPrQueue((q) => q.slice(1))}
        onDone={() => router.replace("/hoy")}
      />
    );
  }

  if (!s) return <FullScreenMessage>Preparando tu sesión…</FullScreenMessage>;

  const currentExercise: DraftExercise | undefined = s.exercises[s.activeExerciseIdx];
  const currentSet: DraftSet | undefined = currentExercise?.sets[s.activeSetIdx];
  const nextExercise =
    s.activeExerciseIdx + 1 < s.exercises.length ? s.exercises[s.activeExerciseIdx + 1] : null;
  const empty = s.exercises.length === 0;
  const allDone = !empty && !currentSet;

  async function handleFinish() {
    const result = await session.finish();
    setFinishResult(result);
    setPrQueue(result.rewards?.new_prs ?? []);
  }

  return (
    <div className="flex min-h-dvh flex-col gap-6 px-4 pb-6 pt-4">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/hoy")}
          aria-label="Minimizar entrenamiento"
          className="superficie flex h-10 w-10 items-center justify-center text-[var(--fg-muted)]"
        >
          <X size={18} strokeWidth={2} />
        </button>
        <span className="texto-dato text-lg text-[var(--fg-muted)]">{fmtClock(elapsed)}</span>
        {s.restResetKey > 0 ? (
          <TimerDescanso initialSeconds={90} resetKey={s.restResetKey} />
        ) : (
          <span className="w-10" aria-hidden />
        )}
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        {empty ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-[var(--fg-muted)]">Sesión libre: añade el primer ejercicio.</p>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex min-h-12 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-6 font-semibold text-[var(--accent-contrast)]"
            >
              <Plus size={18} strokeWidth={2.25} aria-hidden />
              Añadir ejercicio
            </button>
          </div>
        ) : allDone ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="texto-display text-lg text-[var(--fg)]">Rutina completa</p>
            <p className="text-sm text-[var(--fg-muted)]">
              Puedes añadir otra serie, sumar un ejercicio o cerrar tu entrenamiento.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={session.addSetToCurrent}
                className="superficie flex min-h-11 items-center px-4 text-sm text-[var(--fg)]"
              >
                + Serie extra
              </button>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="superficie flex min-h-11 items-center px-4 text-sm text-[var(--fg)]"
              >
                + Ejercicio
              </button>
            </div>
          </div>
        ) : (
          currentExercise &&
          currentSet && (
            <ActivePanel
              exercise={currentExercise}
              set={currentSet}
              activeIndex={s.activeSetIdx}
              nextExerciseName={nextExercise?.name}
              onUpdate={session.updateCurrentSet}
              onComplete={session.completeCurrentSet}
              onAddSet={session.addSetToCurrent}
              onSkipToNext={() => session.jumpToExercise(s.activeExerciseIdx + 1)}
            />
          )
        )}
      </div>

      <div className="flex flex-col gap-2">
        {!empty && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={s.activeExerciseIdx === 0}
              onClick={() => session.jumpToExercise(s.activeExerciseIdx - 1)}
              className="text-sm text-[var(--fg-muted)] disabled:opacity-30"
            >
              ← Ejercicio anterior
            </button>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
            >
              + Añadir ejercicio
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={handleFinish}
          className={`flex min-h-12 items-center justify-center rounded-[var(--radius-control)] text-sm font-semibold transition-[filter] duration-[var(--duration-fast)] ${
            allDone
              ? "bg-[var(--accent)] text-[var(--accent-contrast)] hover:brightness-110"
              : "superficie text-[var(--fg-muted)] hover:text-[var(--fg)]"
          }`}
        >
          Finalizar entrenamiento
        </button>
      </div>

      {picking && (
        <ExercisePicker
          onSelect={(ex: Exercise) => {
            void session.addExercise(ex);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

function ActivePanel({
  exercise,
  set,
  activeIndex,
  nextExerciseName,
  onUpdate,
  onComplete,
  onAddSet,
  onSkipToNext,
}: {
  exercise: DraftExercise;
  set: DraftSet;
  activeIndex: number;
  nextExerciseName?: string;
  onUpdate: (patch: Partial<Pick<DraftSet, "weight_kg" | "reps" | "rpe">>) => void;
  onComplete: () => void;
  onAddSet: () => void;
  onSkipToNext: () => void;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="texto-display text-sm tracking-wide text-[var(--fg-muted)]">
          {exercise.name.toUpperCase()} · serie {activeIndex + 1}
        </p>
        <p className="texto-dato text-6xl font-bold text-[var(--fg)]">
          {fmtKg(set.weight_kg)} <span className="text-2xl text-[var(--fg-muted)]">kg</span>
        </p>
      </div>

      <Stepper
        value={set.weight_kg}
        onChange={(v) => onUpdate({ weight_kg: v })}
        step={2.5}
        min={0}
        max={500}
        format={fmtKg}
        label="peso"
      />

      <div className="flex flex-col items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">Repeticiones</span>
        <Stepper
          value={set.reps}
          onChange={(v) => onUpdate({ reps: Math.round(v) })}
          step={1}
          min={0}
          max={200}
          label="repeticiones"
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">RPE</span>
        <div className="flex flex-wrap justify-center gap-1.5">
          {RPE_OPTIONS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onUpdate({ rpe: set.rpe === v ? null : v })}
              className={`superficie flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs transition-colors duration-[var(--duration-fast)] ${
                set.rpe === v ? "border-[var(--accent)] text-[var(--accent)]" : "text-[var(--fg-muted)]"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onComplete}
        className="flex min-h-16 w-full items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] text-lg font-bold uppercase tracking-wide text-[var(--accent-contrast)] transition-[filter] duration-[var(--duration-fast)] hover:brightness-110 active:brightness-95"
      >
        Completar serie
      </button>

      {exercise.sets.length > 1 && (
        <ul className="flex w-full flex-col gap-1.5">
          {exercise.sets.map((st, i) => (
            <SetRow
              key={st.id}
              index={i}
              weightKg={st.weight_kg}
              reps={st.reps}
              rpe={st.rpe}
              state={st.is_completed ? "done" : i === activeIndex ? "active" : "pending"}
              onComplete={i === activeIndex ? onComplete : undefined}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onAddSet}
        className="text-sm text-[var(--fg-muted)] underline-offset-4 hover:text-[var(--fg)] hover:underline"
      >
        + Añadir serie
      </button>

      {nextExerciseName && (
        <button type="button" onClick={onSkipToNext} className="text-sm text-[var(--fg-muted)]">
          Siguiente: {nextExerciseName} →
        </button>
      )}
    </div>
  );
}

function ResumenSesion({
  summary,
  rewards,
  prQueue,
  onDismissPr,
  onDone,
}: {
  summary: SessionSummary;
  rewards: SyncResponse["rewards"] | null;
  prQueue: SyncResponse["rewards"]["new_prs"];
  onDismissPr: () => void;
  onDone: () => void;
}) {
  const activePr = prQueue[0];
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center"
    >
      <p className="texto-display text-sm tracking-widest text-[var(--fg-muted)]">ENTRENAMIENTO TERMINADO</p>

      <div>
        <p className="texto-dato text-5xl font-bold text-[var(--fg)]">
          <CountUp value={Math.round(summary.volumeKg)} format={(n) => n.toLocaleString("es-MX")} /> kg
        </p>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">volumen total</p>
      </div>

      <div className="flex justify-center gap-8">
        <div>
          <p className="texto-dato text-2xl font-bold text-[var(--fg)]">
            <CountUp value={Math.round(summary.durationSeconds / 60)} delayMs={150} /> min
          </p>
          <p className="text-xs text-[var(--fg-muted)]">duración</p>
        </div>
        <div>
          <p className="texto-dato text-2xl font-bold text-[var(--fg)]">
            <CountUp value={summary.setsCompleted} delayMs={300} />
          </p>
          <p className="text-xs text-[var(--fg-muted)]">series</p>
        </div>
        <div>
          <p className="texto-dato text-2xl font-bold text-[var(--fg)]">
            <CountUp value={rewards?.new_prs.length ?? 0} delayMs={450} />
          </p>
          <p className="text-xs text-[var(--fg-muted)]">PRs</p>
        </div>
      </div>

      {!rewards && (
        <p className="max-w-xs text-sm text-[var(--fg-muted)]">
          Sin conexión: tu entrenamiento se guardó y se sincronizará solo. Las recompensas llegarán al reconectar.
        </p>
      )}

      <button
        type="button"
        onClick={onDone}
        className="flex min-h-12 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-8 font-semibold text-[var(--accent-contrast)] transition-[filter] duration-[var(--duration-fast)] hover:brightness-110"
      >
        Ir a Hoy
      </button>

      {activePr && (
        <TarjetaPR
          exerciseName={activePr.exercise_name}
          weightKg={activePr.weight_kg}
          reps={activePr.reps}
          onClose={onDismissPr}
        />
      )}
    </div>
  );
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
      <span className="texto-display animate-pulse text-2xl text-[var(--fg-muted)]">{children}</span>
    </main>
  );
}
