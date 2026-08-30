"use client";

import { useCallback, useEffect, useState } from "react";
import type { Exercise, ExerciseLastSet, RoutineDetail, SyncResponse, Workout } from "@forja/shared";
import { api } from "@/lib/api";
import {
  discardLocalWorkout,
  getActiveLocalWorkout,
  getLocalWorkout,
  upsertLocalWorkout,
} from "@/lib/offline/db";
import { flushOutbox } from "@/lib/offline/sync";

const DEFAULT_REPS = 8;
const DEFAULT_WEIGHT_KG = 20;
const DEFAULT_REST_SECONDS = 90;

export interface DraftSet {
  id: string;
  position: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  is_completed: boolean;
}
export interface DraftExercise {
  id: string;
  exercise_id: string;
  name: string;
  position: number;
  sets: DraftSet[];
}

interface State {
  id: string;
  routineId: string | null;
  title: string;
  startedAt: string;
  clientUpdatedAt: string;
  exercises: DraftExercise[];
  activeExerciseIdx: number;
  activeSetIdx: number;
  restResetKey: number;
}

export interface SessionSummary {
  durationSeconds: number;
  volumeKg: number;
  setsCompleted: number;
}

type Status = "loading" | "active" | "finishing" | "finished" | "error";

function bump(s: State): State {
  return { ...s, clientUpdatedAt: new Date().toISOString() };
}

function toWorkout(s: State, endedAt: string | null): Workout {
  return {
    id: s.id,
    routine_id: s.routineId,
    title: s.title,
    notes: null,
    started_at: s.startedAt,
    ended_at: endedAt,
    client_updated_at: s.clientUpdatedAt,
    exercises: s.exercises.map((ex) => ({
      id: ex.id,
      exercise_id: ex.exercise_id,
      position: ex.position,
      sets: ex.sets.map((st) => ({
        id: st.id,
        position: st.position,
        reps: st.reps,
        weight_kg: st.weight_kg,
        rpe: st.rpe,
        is_completed: st.is_completed,
      })),
    })),
  };
}

function lastSetOf(ex: DraftExercise): DraftSet | undefined {
  return ex.sets[ex.sets.length - 1];
}

function firstIncomplete(exercises: DraftExercise[]): { exerciseIdx: number; setIdx: number } {
  for (let ei = 0; ei < exercises.length; ei++) {
    const si = exercises[ei].sets.findIndex((s) => !s.is_completed);
    if (si !== -1) return { exerciseIdx: ei, setIdx: si };
  }
  const last = exercises.length - 1;
  return { exerciseIdx: Math.max(0, last), setIdx: exercises[last]?.sets.length ?? 0 };
}

async function fetchLastSet(exerciseId: string): Promise<ExerciseLastSet | null> {
  return api<ExerciseLastSet | null>(`/workouts/last-set/${exerciseId}`).catch(() => null);
}

async function fetchExerciseNames(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  const pairs = await Promise.all(
    unique.map(async (id) => {
      try {
        const ex = await api<Exercise>(`/exercises/${id}`);
        return [id, ex.name] as const;
      } catch {
        return [id, "Ejercicio"] as const;
      }
    }),
  );
  return Object.fromEntries(pairs);
}

/**
 * Maquina de estados del logger de sesion activa (plan §6.2).
 * Local-first: solo persiste en Dexie+outbox al completar series (mutaciones
 * reales); los ajustes de peso/reps/RPE del set en curso son efimeros hasta
 * confirmarse — asi el outbox no se llena con cada tap del stepper.
 */
export function useActiveSession(opts: { routineId?: string; resumeId?: string }) {
  const { routineId, resumeId } = opts;
  const [state, setState] = useState<State | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        if (resumeId) {
          const local = await getLocalWorkout(resumeId);
          if (!local) throw new Error("Sesion no encontrada");
          const names = await fetchExerciseNames(local.exercises.map((e) => e.exercise_id));
          const exercises: DraftExercise[] = local.exercises
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((ex) => ({
              id: ex.id,
              exercise_id: ex.exercise_id,
              name: names[ex.exercise_id] ?? "Ejercicio",
              position: ex.position,
              sets: ex.sets
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((s) => ({
                  id: s.id,
                  position: s.position,
                  reps: s.reps,
                  weight_kg: s.weight_kg,
                  rpe: s.rpe ?? null,
                  is_completed: s.is_completed,
                })),
            }));
          const { exerciseIdx, setIdx } = firstIncomplete(exercises);
          if (cancelled) return;
          setState({
            id: local.id,
            routineId: local.routine_id ?? null,
            title: local.title,
            startedAt: local.started_at,
            clientUpdatedAt: local.client_updated_at,
            exercises,
            activeExerciseIdx: exerciseIdx,
            activeSetIdx: setIdx,
            restResetKey: 0,
          });
          setStatus("active");
          return;
        }

        // Solo una sesion activa a la vez: si ya hay una sin terminar, se retoma.
        const existing = await getActiveLocalWorkout();
        if (existing) {
          if (!cancelled) setRedirectTo(`/sesion?resume=${existing.id}`);
          return;
        }

        const id = crypto.randomUUID();
        const startedAt = new Date().toISOString();
        let title = "Entrenamiento";
        let routine_id: string | null = null;
        let exercises: DraftExercise[] = [];

        if (routineId) {
          const detail = await api<RoutineDetail>(`/routines/${routineId}`);
          title = detail.name;
          routine_id = detail.id;
          exercises = await Promise.all(
            detail.exercises.map(async (ex) => {
              const last = await fetchLastSet(ex.exercise_id);
              return {
                id: crypto.randomUUID(),
                exercise_id: ex.exercise_id,
                name: ex.exercise_name,
                position: ex.position,
                sets: ex.sets.map((s) => ({
                  id: crypto.randomUUID(),
                  position: s.position,
                  reps: s.target_reps ?? last?.reps ?? DEFAULT_REPS,
                  weight_kg: s.target_weight_kg ?? last?.weight_kg ?? DEFAULT_WEIGHT_KG,
                  rpe: s.target_rpe ?? null,
                  is_completed: false,
                })),
              };
            }),
          );
        }

        if (cancelled) return;
        setState({
          id,
          routineId: routine_id,
          title,
          startedAt,
          clientUpdatedAt: startedAt,
          exercises,
          activeExerciseIdx: 0,
          activeSetIdx: 0,
          restResetKey: 0,
        });
        setStatus("active");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [routineId, resumeId]);

  const updateCurrentSet = useCallback((patch: Partial<Pick<DraftSet, "weight_kg" | "reps" | "rpe">>) => {
    setState((prev) => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((ex, ei) =>
        ei !== prev.activeExerciseIdx
          ? ex
          : { ...ex, sets: ex.sets.map((s, si) => (si !== prev.activeSetIdx ? s : { ...s, ...patch })) },
      );
      return { ...prev, exercises };
    });
  }, []);

  const completeCurrentSet = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      const exIdx = prev.activeExerciseIdx;
      const setIdx = prev.activeSetIdx;
      const current = prev.exercises[exIdx];
      if (!current || setIdx >= current.sets.length) return prev;

      const exercises = prev.exercises.map((ex, ei) =>
        ei !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, si) => (si !== setIdx ? s : { ...s, is_completed: true })) },
      );

      let nextExIdx = exIdx;
      let nextSetIdx = setIdx + 1;
      if (nextSetIdx >= exercises[exIdx].sets.length) {
        if (exIdx + 1 < exercises.length) {
          nextExIdx = exIdx + 1;
          nextSetIdx = 0;
        } else {
          nextSetIdx = exercises[exIdx].sets.length; // sin mas series: senal de sesion completa
        }
      }

      const next = bump({
        ...prev,
        exercises,
        activeExerciseIdx: nextExIdx,
        activeSetIdx: nextSetIdx,
        restResetKey: prev.restResetKey + 1,
      });
      navigator.vibrate?.(30);
      void upsertLocalWorkout(toWorkout(next, null));
      return next;
    });
  }, []);

  const addSetToCurrent = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((ex, ei) => {
        if (ei !== prev.activeExerciseIdx) return ex;
        const last = lastSetOf(ex);
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              id: crypto.randomUUID(),
              position: ex.sets.length + 1,
              reps: last?.reps ?? DEFAULT_REPS,
              weight_kg: last?.weight_kg ?? DEFAULT_WEIGHT_KG,
              rpe: last?.rpe ?? null,
              is_completed: false,
            },
          ],
        };
      });
      return { ...prev, exercises };
    });
  }, []);

  const addExercise = useCallback(async (exercise: Exercise) => {
    const last = await fetchLastSet(exercise.id);
    setState((prev) => {
      if (!prev) return prev;
      const wasEmpty = prev.exercises.length === 0;
      const newExercise: DraftExercise = {
        id: crypto.randomUUID(),
        exercise_id: exercise.id,
        name: exercise.name,
        position: prev.exercises.length + 1,
        sets: [
          {
            id: crypto.randomUUID(),
            position: 1,
            reps: last?.reps ?? DEFAULT_REPS,
            weight_kg: last?.weight_kg ?? DEFAULT_WEIGHT_KG,
            rpe: last?.rpe ?? null,
            is_completed: false,
          },
        ],
      };
      return {
        ...prev,
        exercises: [...prev.exercises, newExercise],
        activeExerciseIdx: wasEmpty ? 0 : prev.activeExerciseIdx,
        activeSetIdx: wasEmpty ? 0 : prev.activeSetIdx,
      };
    });
  }, []);

  const jumpToExercise = useCallback((idx: number) => {
    setState((prev) => {
      if (!prev || idx < 0 || idx >= prev.exercises.length) return prev;
      const si = prev.exercises[idx].sets.findIndex((s) => !s.is_completed);
      return { ...prev, activeExerciseIdx: idx, activeSetIdx: si === -1 ? prev.exercises[idx].sets.length : si };
    });
  }, []);

  const finish = useCallback(async (): Promise<{
    rewards: SyncResponse["rewards"] | null;
    summary: SessionSummary;
  }> => {
    const empty = { durationSeconds: 0, volumeKg: 0, setsCompleted: 0 };
    if (!state) return { rewards: null, summary: empty };

    const endedAt = new Date().toISOString();
    const finalState = bump(state);
    const workout = toWorkout(finalState, endedAt);
    await upsertLocalWorkout(workout);
    setState(finalState);
    setStatus("finishing");

    let volumeKg = 0;
    let setsCompleted = 0;
    for (const ex of workout.exercises) {
      for (const s of ex.sets) {
        if (s.is_completed) {
          volumeKg += s.weight_kg * s.reps;
          setsCompleted++;
        }
      }
    }
    const summary: SessionSummary = {
      durationSeconds: Math.round((new Date(endedAt).getTime() - new Date(workout.started_at).getTime()) / 1000),
      volumeKg,
      setsCompleted,
    };

    let rewards: SyncResponse["rewards"] | null = null;
    try {
      rewards = await flushOutbox();
    } catch {
      rewards = null;
    }
    setStatus("finished");
    return { rewards, summary };
  }, [state]);

  const discard = useCallback(async () => {
    if (!state) return;
    await discardLocalWorkout(state.id);
  }, [state]);

  return {
    status,
    state,
    redirectTo,
    updateCurrentSet,
    completeCurrentSet,
    addSetToCurrent,
    addExercise,
    jumpToExercise,
    finish,
    discard,
  };
}

export const SESSION_DEFAULTS = { DEFAULT_REPS, DEFAULT_WEIGHT_KG, DEFAULT_REST_SECONDS };
