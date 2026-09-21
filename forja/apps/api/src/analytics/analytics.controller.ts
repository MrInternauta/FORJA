import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
  DistributionQuerySchema,
  ExerciseHistoryQuerySchema,
  VolumeQuerySchema,
  WeeklySummaryQuerySchema,
} from "@forja/shared";
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

  @Get("distribution")
  distribution(@CurrentUser() user: JwtUser, @Query() query: unknown) {
    return this.analytics.distribution(user.id, zodParse(DistributionQuerySchema, query));
  }

  @Get("prs")
  prs(@CurrentUser() user: JwtUser) {
    return this.analytics.personalRecords(user.id);
  }

  @Get("exercise/:id/history")
  exerciseHistory(
    @CurrentUser() user: JwtUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: unknown,
  ) {
    const { limit } = zodParse(ExerciseHistoryQuerySchema, query);
    return this.analytics.exerciseHistory(user.id, id, limit);
  }

  @Get("weekly-summary")
  weeklySummary(@CurrentUser() user: JwtUser, @Query() query: unknown) {
    const { week } = zodParse(WeeklySummaryQuerySchema, query);
    return this.analytics.weeklySummary(user.id, week);
  }
}
