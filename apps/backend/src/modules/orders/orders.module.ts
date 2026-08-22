import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PaymentProviderFactory } from "./payment-provider.factory";
import { TaxService } from "./tax.service";
import { ObservabilityModule } from "../observability/observability.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PayoutsModule } from "../payouts/payouts.module";
import { FeesModule } from "../fees/fees.module";
import { ShippingModule } from "../shipping/shipping.module";
import { ShippoWebhookController } from "./shippo-webhook.controller";

@Module({
  imports: [
    HttpModule,
    PrismaModule,
    ObservabilityModule,
    NotificationsModule,
    PayoutsModule,
    FeesModule,
    ShippingModule,
  ],
  controllers: [OrdersController, PaymentsController, ShippoWebhookController],
  providers: [
    OrdersService,
    PaymentsService,
    PaymentProviderFactory,
    TaxService,
  ],
  exports: [OrdersService, PaymentsService, TaxService],
})
export class OrdersModule {}
