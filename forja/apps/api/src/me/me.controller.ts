import { Body, Controller, Delete, Get, HttpCode, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { OnboardingSchema } from "@forja/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtUser } from "../auth/jwt-user";
import { zodParse } from "../common/zod";
import { MeService } from "./me.service";
import { DatabaseService } from "../database/database.service";

const PatchMeSchema = z.object({
  display_name: z.string().min(1).max(60).optional(),
  avatar_url: z.string().url().optional(),
  is_public: z.boolean().optional(),
  weekly_goal: z.number().int().min(1).max(7).optional(),
});

@Controller()
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly db: DatabaseService,
  ) {}

  /** Contrato: POST /auth/onboarding (arquitectura §4). */
  @Post("auth/onboarding")
  onboard(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    return this.me.onboard(user.id, zodParse(OnboardingSchema, body));
  }

  @Get("me")
  getMe(@CurrentUser() user: JwtUser) {
    return this.me.getMe(user.id);
  }

  /** Vitrina de medallas: catalogo + ganados + progreso. */
  @Get("me/achievements")
  achievements(@CurrentUser() user: JwtUser) {
    return this.me.achievements(user.id);
  }

  @Patch("me")
  async patchMe(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    await this.me.updateMe(user.id, zodParse(PatchMeSchema, body));
    return { ok: true };
  }

  /** Borrado de cuenta: cascada desde auth.users la ejecuta Supabase; aqui borramos el perfil. */
  @Delete("me")
  @HttpCode(204)
  async deleteMe(@CurrentUser() user: JwtUser) {
    await this.db.query("delete from public.profiles where id = $1", [user.id]);
    // TODO(fase MVP tardia): borrar tambien auth.users via Admin API de Supabase.
  }
}
