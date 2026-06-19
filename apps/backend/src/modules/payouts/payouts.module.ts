import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaystackService } from '../orders/paystack.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [HttpModule, PrismaModule, NotificationsModule],
  controllers: [PayoutsController],
  providers: [PayoutsService, PaystackService],
  exports: [PayoutsService, PaystackService],
})
export class PayoutsModule {}
