import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AppRole } from "@forja/shared";
import { ROLES_KEY } from "./roles.decorator";
import type { JwtUser } from "./jwt-user";

/** Segunda capa: el rol del claim debe estar en la lista del decorador @Roles. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest<{ user?: JwtUser }>();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException("Tu plan o rol no permite esta accion");
    }
    return true;
  }
}
