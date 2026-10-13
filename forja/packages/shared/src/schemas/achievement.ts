import { z } from "zod";
import { ACHIEVEMENT_METRICS } from "../achievements";
import { ACHIEVEMENT_TIERS } from "../enums";

/** Un logro del catalogo con el estado del usuario. Contrato: GET /me/achievements. */
export const AchievementStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tier: z.enum(ACHIEVEMENT_TIERS),
  /** Categoria de la vitrina (sesiones, volumen, racha, records). */
  metric: z.enum(ACHIEVEMENT_METRICS),
  earned_at: z.string().nullable(),
  /** null si la regla aun no es medible (`measurable: false`). `current` se topa en `target`. */
  progress: z.object({ current: z.number(), target: z.number() }).nullable(),
});
export type AchievementStatus = z.infer<typeof AchievementStatusSchema>;
