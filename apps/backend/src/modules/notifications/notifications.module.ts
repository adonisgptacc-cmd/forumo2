import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaModule } from '../../prisma/prisma.module';
import { RateLimitService } from '../../common/services/rate-limit.service';

@Module({
  imports: [HttpModule, PrismaModule],
  providers: [NotificationsService, NotificationsGateway, RateLimitService],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
