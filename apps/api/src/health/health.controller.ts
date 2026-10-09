import { Controller, Get } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";

@Public()
@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "petflow-api",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
