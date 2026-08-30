import type { AppRole } from "@forja/shared";

/** Identidad extraida del JWT de Supabase y adjuntada al request. */
export interface JwtUser {
  id: string;        // sub
  role: AppRole;     // claim user_role (hook) o FREE por defecto
}
