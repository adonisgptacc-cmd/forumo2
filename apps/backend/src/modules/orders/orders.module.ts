import { Module } from '@nestjs/common';

import { PrismaModule } from "../../prisma/prisma.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { RateLimitService } from "../../common/services/rate-limit.service";
import { ObservabilityModule } from "../observability/observability.module";

@Module({
  imports: [PrismaModule, ObservabilityModule],
  controllers: [OrdersController, PaymentsController],
  providers: [OrdersService, PaymentsService, RateLimitService],
  exports: [OrdersService, PaymentsService],
})
export class OrdersModule {}
