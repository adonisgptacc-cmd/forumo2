import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { AuditLogService } from "./audit-log.service";
import { PrismaModule } from "../../prisma/prisma.module";

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [MetricsController],
  providers: [MetricsService, AuditLogService],
  exports: [MetricsService, AuditLogService],
})
export class ObservabilityModule {}
