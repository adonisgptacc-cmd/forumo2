import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ListingsModule } from '../listings/listings.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [ConfigModule, ListingsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
