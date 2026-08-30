import { SetMetadata } from "@nestjs/common";
import type { AppRole } from "@forja/shared";

export const ROLES_KEY = "roles";
/** Restringe un endpoint a roles concretos. ADMIN nunca se incluye implicito: declararlo. */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
