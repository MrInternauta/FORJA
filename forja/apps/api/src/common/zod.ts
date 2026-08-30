import { BadRequestException } from "@nestjs/common";
import type { ZodTypeAny, z } from "zod";

/** Parseo Zod -> 400 con detalle de campos. Una sola convencion de validacion en toda la API. */
export function zodParse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestException({
      message: "Payload invalido",
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return result.data;
}
