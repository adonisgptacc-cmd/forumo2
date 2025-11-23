import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { AuditLogService } from './audit-log.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [MetricsController],
  providers: [MetricsService, AuditLogService],
  exports: [MetricsService, AuditLogService],
})
export class ObservabilityModule {}
