import { z } from "zod";

/**
 * Recompensas pendientes de celebrar (plan de diseno §8.3). El backend las
 * guarda al calcularlas en el sync; el cliente las lee con GET /me/rewards y
 * las confirma con POST /me/rewards/ack al mostrarlas. Asi una respuesta de
 * sync perdida ya no pierde la celebracion.
 */
const base = { id: z.string().uuid(), created_at: z.string() };

export const PendingRewardSchema = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("pr"),
    payload: z.object({
      exercise_id: z.string().uuid(),
      exercise_name: z.string(),
      weight_kg: z.number(),
      reps: z.number().int(),
    }),
  }),
  z.object({ ...base, kind: z.literal("achievement"), payload: z.object({ id: z.string() }) }),
  z.object({ ...base, kind: z.literal("streak"), payload: z.object({ delta: z.number().int() }) }),
]);
export type PendingReward = z.infer<typeof PendingRewardSchema>;

export const AckRewardsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});
export type AckRewardsInput = z.infer<typeof AckRewardsSchema>;
