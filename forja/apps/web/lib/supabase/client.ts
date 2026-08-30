import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/**
 * Cliente de Supabase para el navegador. El frontend SOLO lo usa para auth
 * y para leer media de Storage (arquitectura §2): los datos de negocio
 * viajan siempre por la API NestJS.
 * Devuelve null si faltan las variables publicas (la UI lo maneja con aviso).
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && anon ? createClient(url, anon) : null;
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
