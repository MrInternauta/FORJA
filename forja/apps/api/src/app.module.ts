import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { MeModule } from "./me/me.module";
import { ExercisesModule } from "./exercises/exercises.module";
import { RoutinesModule } from "./routines/routines.module";
import { WorkoutsModule } from "./workouts/workouts.module";
import { AnalyticsModule } from "./analytics/analytics.module";

/**
 * Modulos por dominio segun contratos de API (arquitectura §4).
 * social/ y billing/ se anaden en sus fases del roadmap.
 */
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    MeModule,
    ExercisesModule,
    RoutinesModule,
    WorkoutsModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
