import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ description: 'Service is healthy' })
  async getHealth() {
    return this.healthService.getStatus();
  }

  @Get('live')
  @ApiOkResponse({ description: 'Liveness probe' })
  async getLiveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOkResponse({ description: 'Readiness probe' })
  async getReadiness() {
    return this.healthService.getStatus();
  }
}
