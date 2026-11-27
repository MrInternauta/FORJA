import { api } from "../api";
import { localDb } from "../offline/db";
import { volumenDeSesion, type VolumenLocal } from "./volumen";

interface WorkoutListPage {
  items: { id: string; ended_at: string | null }[];
  next_cursor: string | null;
}

/**
 * Sesiones terminadas en este dispositivo que la red aun no cuenta en
 * `GET /analytics/volume` (como Hoy, arquitectura §6). Cada workout cuenta una
 * sola vez y gana la copia de red: si el servidor ya lo tiene terminado (p. ej.
 * se edito despues de sincronizar, o se perdio la respuesta del sync), su volumen
 * ya viene en la grafica y la copia local se ignora. Sin red no hay como
 * saberlo: cuentan las locales (lo normal offline es una sesion nueva).
 */
export async function volumenPendienteLocal(): Promise<VolumenLocal[]> {
  const pendientes = (await localDb.workouts.where("sync_status").equals("pending").toArray()).filter(
    (w) => w.ended_at,
  );
  if (pendientes.length === 0) return [];

  const terminadasEnRed = new Set<string>();
  const inicios = pendientes.map((w) => w.started_at).sort();
  const rango = `from=${encodeURIComponent(inicios[0])}&to=${encodeURIComponent(inicios[inicios.length - 1])}`;
  try {
    let cursor: string | null = null;
    do {
      const page: WorkoutListPage = await api<WorkoutListPage>(
        `/workouts?${rango}${cursor ? `&cursor=${cursor}` : ""}`,
      );
      for (const item of page.items) if (item.ended_at) terminadasEnRed.add(item.id);
      cursor = page.next_cursor;
    } while (cursor);
  } catch {
    /* offline: cuentan todas las locales */
  }

  return pendientes
    .filter((w) => !terminadasEnRed.has(w.id))
    .map((w) => ({ started_at: w.started_at, volume_kg: volumenDeSesion(w) }));
}
