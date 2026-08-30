import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { OnboardingInput, Profile, UserStats } from "@forja/shared";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class MeService {
  constructor(private readonly db: DatabaseService) {}

  /** Crea profiles + user_stats tras el primer login (arquitectura §5, paso 3). */
  async onboard(userId: string, input: OnboardingInput): Promise<Profile> {
    return this.db.tx(async (tx) => {
      const existing = await tx.query("select 1 from public.profiles where id = $1", [userId]);
      if ((existing.rowCount ?? 0) > 0) throw new ConflictException("El perfil ya existe");

      const taken = await tx.query("select 1 from public.profiles where username = $1", [
        input.username,
      ]);
      if ((taken.rowCount ?? 0) > 0) throw new ConflictException("Ese nombre de usuario ya esta en uso");

      const { rows } = await tx.query<Profile>(
        `insert into public.profiles (id, username, display_name)
         values ($1, $2, $3)
         returning id, username, display_name, avatar_url, role, is_public`,
        [userId, input.username, input.display_name ?? null],
      );
      await tx.query("insert into public.user_stats (user_id) values ($1)", [userId]);
      return rows[0];
    });
  }

  async getMe(userId: string): Promise<{ profile: Profile; stats: UserStats }> {
    const [profile] = await this.db.query<Profile>(
      `select id, username, display_name, avatar_url, role, is_public
       from public.profiles where id = $1`,
      [userId],
    );
    if (!profile) throw new NotFoundException("Perfil no encontrado: completa el onboarding");

    const [stats] = await this.db.query<UserStats>(
      `select weekly_goal, current_streak, longest_streak, grace_weeks,
              total_volume_kg::float8 as total_volume_kg, total_workouts
       from public.user_stats where user_id = $1`,
      [userId],
    );
    return { profile, stats };
  }

  async updateMe(
    userId: string,
    patch: { display_name?: string; avatar_url?: string; is_public?: boolean; weekly_goal?: number },
  ): Promise<void> {
    await this.db.tx(async (tx) => {
      if (
        patch.display_name !== undefined ||
        patch.avatar_url !== undefined ||
        patch.is_public !== undefined
      ) {
        await tx.query(
          `update public.profiles set
             display_name = coalesce($2, display_name),
             avatar_url   = coalesce($3, avatar_url),
             is_public    = coalesce($4, is_public)
           where id = $1`,
          [userId, patch.display_name ?? null, patch.avatar_url ?? null, patch.is_public ?? null],
        );
      }
      if (patch.weekly_goal !== undefined) {
        await tx.query(
          "update public.user_stats set weekly_goal = $2, updated_at = now() where user_id = $1",
          [userId, patch.weekly_goal],
        );
      }
    });
  }
}
