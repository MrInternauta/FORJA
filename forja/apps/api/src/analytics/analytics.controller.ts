import { Controller, Get, Query } from "@nestjs/common";
import { VolumeQuerySchema } from "@forja/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtUser } from "../auth/jwt-user";
import { zodParse } from "../common/zod";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("volume")
  volume(@CurrentUser() user: JwtUser, @Query() query: unknown) {
    const { weeks } = zodParse(VolumeQuerySchema, query);
    return this.analytics.weeklyVolume(user.id, weeks);
  }
}
