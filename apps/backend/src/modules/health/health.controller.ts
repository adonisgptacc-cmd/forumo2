import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { HealthService } from "./health.service";

// Probes are polled by Docker/k8s; rate limiting them marks healthy services unhealthy.
@SkipThrottle()
@ApiTags("health")
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get(["health", "healthz"])
  @ApiOkResponse({ description: "Service is healthy" })
  async getHealth() {
    return this.healthService.getStatus();
  }

  @Get("health/live")
  @ApiOkResponse({ description: "Liveness probe" })
  async getLiveness() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("health/ready")
  @ApiOkResponse({ description: "Readiness probe" })
  async getReadiness() {
    return this.healthService.getStatus();
  }

  @Get("healthz/live")
  @ApiOkResponse({ description: "Liveness probe (healthz alias)" })
  async getLivenessAlias() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("healthz/ready")
  @ApiOkResponse({ description: "Readiness probe (healthz alias)" })
  async getReadinessAlias() {
    return this.healthService.getStatus();
  }
}
