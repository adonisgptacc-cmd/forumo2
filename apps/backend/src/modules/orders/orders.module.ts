import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [OrdersController, PaymentsController],
  providers: [OrdersService, PaymentsService],
  exports: [OrdersService, PaymentsService],
})
export class OrdersModule {}
