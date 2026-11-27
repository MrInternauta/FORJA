import { Body, Controller, Delete, Get, HttpCode, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { AckRewardsSchema, OnboardingSchema, TimeZoneSchema } from "@forja/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtUser } from "../auth/jwt-user";
import { zodParse } from "../common/zod";
import { MeService } from "./me.service";
import { DatabaseService } from "../database/database.service";
import { SupabaseAdminService } from "../auth/supabase-admin.service";

const PatchMeSchema = z.object({
  display_name: z.string().min(1).max(60).optional(),
  avatar_url: z.string().url().optional(),
  is_public: z.boolean().optional(),
  weekly_goal: z.number().int().min(1).max(7).optional(),
  time_zone: TimeZoneSchema.optional(),
});

@Controller()
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly db: DatabaseService,
    private readonly supabaseAdmin: SupabaseAdminService,
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

  /** Recompensas pendientes de celebrar: sobreviven a una respuesta de sync perdida (§8.3). */
  @Get("me/rewards")
  pendingRewards(@CurrentUser() user: JwtUser) {
    return this.me.pendingRewards(user.id);
  }

  @Post("me/rewards/ack")
  @HttpCode(204)
  async ackRewards(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    await this.me.ackRewards(user.id, zodParse(AckRewardsSchema, body).ids);
  }

  @Patch("me")
  async patchMe(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    await this.me.updateMe(user.id, zodParse(PatchMeSchema, body));
    return { ok: true };
  }

  /**
   * Borrado de cuenta. Primero auth.users (Admin API; su cascada se lleva el perfil): si falla,
   * 502 y no se borra nada, para poder reintentar. Sin service role key solo se borra el perfil.
   */
  @Delete("me")
  @HttpCode(204)
  async deleteMe(@CurrentUser() user: JwtUser) {
    await this.supabaseAdmin.deleteUser(user.id);
    await this.db.query("delete from public.profiles where id = $1", [user.id]);
  }
}
