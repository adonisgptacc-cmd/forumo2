import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class ObservabilityModule {}
