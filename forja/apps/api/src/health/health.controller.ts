import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { DatabaseService } from "../database/database.service";

@Controller("health")
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  async health() {
    const [{ ok }] = await this.db.query<{ ok: number }>("select 1 as ok");
    return { status: "ok", db: ok === 1 };
  }
}
