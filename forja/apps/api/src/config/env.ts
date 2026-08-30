import { z } from "zod";

/**
 * Validacion de entorno al arranque: si falta algo critico, el proceso no levanta.
 * (Fail-fast > errores crípticos en runtime.)
 */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  /** Solo proyectos legacy HS256. Vacio => se usa el JWKS publico (claves asimetricas). */
  SUPABASE_JWT_SECRET: z.string().optional().or(z.literal("")),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Variables de entorno invalidas:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
