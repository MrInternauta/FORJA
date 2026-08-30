import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import * as jwt from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";
import { APP_ROLES, type AppRole } from "@forja/shared";
import { env } from "../config/env";
import { IS_PUBLIC_KEY } from "./public.decorator";
import type { JwtUser } from "./jwt-user";

interface SupabaseClaims extends jwt.JwtPayload {
  user_role?: string;
}

/**
 * Valida el JWT emitido por Supabase Auth (arquitectura §5).
 * - Proyectos con claves asimetricas (default): verificacion contra el JWKS publico
 *   ${SUPABASE_URL}/auth/v1/.well-known/jwks.json (RS256/ES256), sin round-trip por request
 *   gracias al cache de claves de jwks-rsa.
 * - Proyectos legacy: HS256 con SUPABASE_JWT_SECRET.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwks = new JwksClient({
    jwksUri: `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
    cache: true,
    cacheMaxAge: 10 * 60 * 1000,
    rateLimit: true,
  });

  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string>; user?: JwtUser }>();
    const header = req.headers["authorization"] ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException("Falta el token Bearer");

    const claims = await this.verify(token).catch(() => {
      throw new UnauthorizedException("Token invalido o expirado");
    });

    if (!claims.sub) throw new UnauthorizedException("Token sin subject");

    const role: AppRole = (APP_ROLES as readonly string[]).includes(claims.user_role ?? "")
      ? (claims.user_role as AppRole)
      : "FREE";

    req.user = { id: claims.sub, role };
    return true;
  }

  private async verify(token: string): Promise<SupabaseClaims> {
    if (env.SUPABASE_JWT_SECRET) {
      return jwt.verify(token, env.SUPABASE_JWT_SECRET, {
        algorithms: ["HS256"],
      }) as SupabaseClaims;
    }
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === "string") throw new Error("Token ilegible");
    const key = await this.jwks.getSigningKey(decoded.header.kid);
    return jwt.verify(token, key.getPublicKey(), {
      algorithms: ["RS256", "ES256"],
    }) as SupabaseClaims;
  }
}
