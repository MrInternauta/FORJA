import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import { CreateRoutineSchema } from "@forja/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtUser } from "../auth/jwt-user";
import { zodParse } from "../common/zod";
import { RoutinesService } from "./routines.service";

const ListQuerySchema = z.object({ cursor: z.string().uuid().optional() });

@Controller("routines")
export class RoutinesController {
  constructor(private readonly routines: RoutinesService) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query() query: unknown) {
    const { cursor } = zodParse(ListQuerySchema, query);
    return this.routines.list(user.id, cursor);
  }

  @Get(":id")
  detail(@CurrentUser() user: JwtUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.routines.detail(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    return this.routines.create(user.id, user.role, zodParse(CreateRoutineSchema, body));
  }

  @Put(":id")
  async replace(
    @CurrentUser() user: JwtUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    await this.routines.replace(user.id, id, zodParse(CreateRoutineSchema, body));
    return { ok: true };
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: JwtUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.routines.remove(user.id, id);
  }
}
