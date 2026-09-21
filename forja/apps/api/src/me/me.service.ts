import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ACHIEVEMENT_RULES } from "@forja/shared";
import type { AchievementMetricValues, AchievementStatus, OnboardingInput, Profile, UserStats } from "@forja/shared";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class MeService {
  private readonly logger = new Logger(MeService.name);

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

  /**
   * Catalogo completo de logros con el estado del usuario: ganados con fecha y
   * bloqueados con su progreso (vitrina "aspiracional", diseno §8.1).
   * Contrato: GET /me/achievements.
   */
  async achievements(userId: string): Promise<AchievementStatus[]> {
    const [values] = await this.db.query<AchievementMetricValues>(
      `select s.total_workouts as workouts,
              s.total_volume_kg::float8 as volume_kg,
              s.longest_streak as streak_weeks,
              (select count(*)::int from public.exercise_prs p where p.user_id = s.user_id) as prs
       from public.user_stats s where s.user_id = $1`,
      [userId],
    );
    if (!values) throw new NotFoundException("Perfil no encontrado: completa el onboarding");

    const rows = await this.db.query<{
      id: string;
      name: string;
      description: string;
      tier: AchievementStatus["tier"];
      earned_at: string | null;
    }>(
      `select a.id, a.name, a.description, a.tier, ua.earned_at
       from public.achievements a
       left join public.user_achievements ua
         on ua.achievement_id = a.id and ua.user_id = $1
       order by a.sort_order`,
      [userId],
    );

    return rows.flatMap((a) => {
      const rule = ACHIEVEMENT_RULES[a.id];
      if (!rule) {
        // Logro sembrado sin regla en @forja/shared: se omite en vez de tumbar la vitrina.
        this.logger.warn(`Logro sin regla en @forja/shared: ${a.id}`);
        return [];
      }
      return {
        ...a,
        metric: rule.metric,
        progress:
          rule.measurable === false
            ? null
            : {
                // Ganado = completo aunque la metrica baje despues (p. ej. borrar un workout).
                current: a.earned_at ? rule.target : Math.min(values[rule.metric], rule.target),
                target: rule.target,
              },
      };
    });
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
