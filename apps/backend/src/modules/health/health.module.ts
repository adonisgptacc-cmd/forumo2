import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [ListingsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
