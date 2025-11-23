import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { RateLimitService } from '../../common/services/rate-limit.service.js';
import { ObservabilityModule } from '../observability/observability.module.js';

@Module({
  imports: [PrismaModule, ObservabilityModule],
  controllers: [OrdersController, PaymentsController],
  providers: [OrdersService, PaymentsService, RateLimitService],
  exports: [OrdersService, PaymentsService],
})
export class OrdersModule {}
