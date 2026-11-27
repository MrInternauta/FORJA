import { Module } from "@nestjs/common";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";
import { SupabaseAdminService } from "../auth/supabase-admin.service";

@Module({
  controllers: [MeController],
  providers: [MeService, { provide: SupabaseAdminService, useFactory: () => new SupabaseAdminService() }],
})
export class MeModule {}
