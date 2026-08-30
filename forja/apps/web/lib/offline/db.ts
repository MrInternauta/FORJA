import Dexie, { type EntityTable } from "dexie";
import type { Workout } from "@forja/shared";

/**
 * Almacen local (arquitectura §6): la UI de entrenamientos lee y escribe
 * SIEMPRE aqui primero (optimistic por construccion); el outbox guarda la
 * intencion hasta que el servidor la confirma.
 */
export interface LocalWorkout extends Workout {
  /** 'synced' | 'pending' — para pintar la BarraSync. */
  sync_status: "synced" | "pending";
}

export interface OutboxEntry {
  seq?: number; // autoincrement
  op: "upsert" | "delete";
  workout_id: string;
  /** Snapshot completo para 'upsert'; vacio para 'delete'. */
  payload: Workout | null;
  client_updated_at: string;
}

export const localDb = new Dexie("forja") as Dexie & {
  workouts: EntityTable<LocalWorkout, "id">;
  outbox: EntityTable<OutboxEntry, "seq">;
};

localDb.version(1).stores({
  workouts: "id, started_at, sync_status",
  outbox: "++seq, workout_id",
});

/**
 * Escritura local-first del logger (plan §6.2 / arquitectura §6): cada mutacion de la
 * sesion activa (completar serie, editar peso) llama a esto. Escribe el documento
 * completo en `workouts` y encola la misma intencion en el outbox; `flushOutbox`
 * compacta por `workout_id` asi que las llamadas repetidas son baratas.
 */
export async function upsertLocalWorkout(workout: Workout): Promise<void> {
  await localDb.transaction("rw", localDb.workouts, localDb.outbox, async () => {
    await localDb.workouts.put({ ...workout, sync_status: "pending" });
    await localDb.outbox.add({
      op: "upsert",
      workout_id: workout.id,
      payload: workout,
      client_updated_at: workout.client_updated_at,
    });
  });
}

/** Sesion(es) sin `ended_at`: para la pildora flotante y para resumir tras recargar. */
export async function getActiveLocalWorkout(): Promise<LocalWorkout | undefined> {
  return localDb.workouts.filter((w) => w.ended_at == null).first();
}

export async function getLocalWorkout(id: string): Promise<LocalWorkout | undefined> {
  return localDb.workouts.get(id);
}

/** Descarta una sesion (p. ej. desde la pildora): borra local y encola el delete por si ya sincronizo. */
export async function discardLocalWorkout(id: string): Promise<void> {
  await localDb.transaction("rw", localDb.workouts, localDb.outbox, async () => {
    await localDb.workouts.delete(id);
    await localDb.outbox.add({
      op: "delete",
      workout_id: id,
      payload: null,
      client_updated_at: new Date().toISOString(),
    });
  });
}
