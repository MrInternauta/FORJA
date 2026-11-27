import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import { env } from "../config/env";

/**
 * Admin API de Supabase Auth (GoTrue) con la service role key. Opcional: sin
 * SUPABASE_SERVICE_ROLE_KEY no hace nada y lo avisa en el log. La clave nunca sale de la API.
 */
@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);

  constructor(
    private readonly config: { url: string; serviceRoleKey?: string } = {
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  ) {}

  /**
   * Borra el usuario de auth.users (la cascada de la BD se lleva su perfil y datos).
   * Devuelve false si no hay clave configurada. Un 404 cuenta como ya borrado (idempotente).
   */
  async deleteUser(userId: string): Promise<boolean> {
    const key = this.config.serviceRoleKey;
    if (!key) {
      this.logger.warn(
        `Sin SUPABASE_SERVICE_ROLE_KEY: el usuario ${userId} sigue en auth.users y podra volver a iniciar sesion`,
      );
      return false;
    }
    let res: Response;
    try {
      res = await fetch(`${this.config.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      this.logger.error(`Admin API de Supabase inalcanzable al borrar ${userId}: ${String(err)}`);
      throw new BadGatewayException("No pudimos borrar tu cuenta en este momento. Intenta de nuevo en unos minutos.");
    }
    if (res.ok || res.status === 404) return true;
    this.logger.error(`Admin API de Supabase respondio ${res.status} al borrar ${userId}: ${await res.text()}`);
    throw new BadGatewayException("No pudimos borrar tu cuenta en este momento. Intenta de nuevo en unos minutos.");
  }
}
