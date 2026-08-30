import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { SyncRequestSchema, WorkoutSchema } from "@forja/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtUser } from "../auth/jwt-user";
import { zodParse } from "../common/zod";
import { WorkoutsService } from "./workouts.service";
import { DatabaseService } from "../database/database.service";

const ListQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().uuid().optional(),
});

@Controller()
export class WorkoutsController {
  constructor(
    private readonly workouts: WorkoutsService,
    private readonly db: DatabaseService,
  ) {}

  @Get("workouts")
  list(@CurrentUser() user: JwtUser, @Query() query: unknown) {
    return this.workouts.list(user.id, zodParse(ListQuerySchema, query));
  }

  /** Autocompletar el logger: ultimo set registrado de un ejercicio (plan §6.2). */
  @Get("workouts/last-set/:exerciseId")
  lastSet(@CurrentUser() user: JwtUser, @Param("exerciseId", ParseUUIDPipe) exerciseId: string) {
    return this.workouts.lastSet(user.id, exerciseId);
  }

  /** POST /workouts individual = sync de un solo upsert (mismo camino de codigo). */
  @Post("workouts")
  async createOne(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    const workout = zodParse(WorkoutSchema, body);
    return this.workouts.sync(user.id, [{ op: "upsert", workout }]);
  }

  @Delete("workouts/:id")
  @HttpCode(204)
  async remove(@CurrentUser() user: JwtUser, @Param("id", ParseUUIDPipe) id: string) {
    await this.db.query("delete from public.workouts where id = $1 and user_id = $2", [id, user.id]);
  }

  /** Contrato: POST /sync/workouts — flush del outbox offline (arquitectura §4/§6). */
  @Post("sync/workouts")
  syncBatch(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    const { operations } = zodParse(SyncRequestSchema, body);
    return this.workouts.sync(user.id, operations);
  }
}
