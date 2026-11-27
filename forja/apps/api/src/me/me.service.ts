import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ACHIEVEMENT_RULES, DEFAULT_TIME_ZONE } from "@forja/shared";
import type {
  AchievementMetricValues,
  AchievementStatus,
  OnboardingInput,
  PendingReward,
  Profile,
  UserStats,
} from "@forja/shared";
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

      const { rows } = await tx
        .query<Profile>(
          `insert into public.profiles (id, username, display_name, time_zone)
           values ($1, $2, $3, $4)
           returning id, username, display_name, avatar_url, role, is_public, time_zone`,
          [userId, input.username, input.display_name ?? null, input.time_zone ?? DEFAULT_TIME_ZONE],
        )
        .catch(zonaDesconocida);
      await tx.query("insert into public.user_stats (user_id) values ($1)", [userId]);
      return rows[0];
    });
  }

  async getMe(userId: string): Promise<{ profile: Profile; stats: UserStats }> {
    const [profile] = await this.db.query<Profile>(
      `select id, username, display_name, avatar_url, role, is_public, time_zone
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
    patch: {
      display_name?: string;
      avatar_url?: string;
      is_public?: boolean;
      weekly_goal?: number;
      time_zone?: string;
    },
  ): Promise<void> {
    // Como weekly_goal, una zona nueva no recalcula la racha guardada: se recalcula en el proximo sync.
    await this.db.tx(async (tx) => {
      if (
        patch.display_name !== undefined ||
        patch.avatar_url !== undefined ||
        patch.is_public !== undefined ||
        patch.time_zone !== undefined
      ) {
        await tx
          .query(
            `update public.profiles set
               display_name = coalesce($2, display_name),
               avatar_url   = coalesce($3, avatar_url),
               is_public    = coalesce($4, is_public),
               time_zone    = coalesce($5, time_zone)
             where id = $1`,
            [
              userId,
              patch.display_name ?? null,
              patch.avatar_url ?? null,
              patch.is_public ?? null,
              patch.time_zone ?? null,
            ],
          )
          .catch(zonaDesconocida);
      }
      if (patch.weekly_goal !== undefined) {
        await tx.query(
          "update public.user_stats set weekly_goal = $2, updated_at = now() where user_id = $1",
          [userId, patch.weekly_goal],
        );
      }
    });
  }

  /**
   * Recompensas aun sin celebrar, en el orden en que se ganaron (plan §8.3).
   * El tope evita una cola infinita si alguien nunca abre la app con conexion.
   */
  async pendingRewards(userId: string): Promise<PendingReward[]> {
    return this.db.query<PendingReward>(
      `select id, kind, payload, created_at
       from public.pending_rewards
       where user_id = $1 and seen_at is null
       order by created_at, id
       limit 50`,
      [userId],
    );
  }

  /** Confirma recompensas ya mostradas. Ids ajenos o ya vistos se ignoran (idempotente). */
  async ackRewards(userId: string, ids: string[]): Promise<void> {
    await this.db.query(
      `update public.pending_rewards set seen_at = now()
       where user_id = $1 and id = any($2::uuid[]) and seen_at is null`,
      [userId, ids],
    );
  }
}

/**
 * El trigger de profiles rechaza con 22023 una zona que Postgres no conoce, aunque
 * Intl la haya aceptado (p. ej. una zona IANA mas nueva que el tzdata de la BD).
 */
function zonaDesconocida(err: unknown): never {
  if ((err as { code?: string }).code === "22023") {
    throw new BadRequestException("Zona horaria desconocida: usa un nombre IANA como America/Mexico_City");
  }
  throw err;
}
