import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { UsersModule } from "./users/users.module";
import { ListingsModule } from "./listings/listings.module";
import { OrdersModule } from "./orders/orders.module";
import { MessagingModule } from "./messaging/messaging.module";
import { AdminModule } from "./admin/admin.module";
import { configSchema } from "../config/config.schema";
import { ReviewsModule } from "./reviews/reviews.module";
import { ObservabilityModule } from "./observability/observability.module";
import { HttpMetricsInterceptor } from "../common/interceptors/http-metrics.interceptor";
import { KycModule } from "./kyc/kyc.module";
import { EscrowModule } from "./escrow/escrow.module";
import { InventoryModule } from "./inventory/inventory.module";
import { AuctionsModule } from "./auctions/auctions.module";
import { StorefrontsModule } from "./storefronts/storefronts.module";
import { OffersModule } from "./offers/offers.module";
import { WishlistModule } from "./wishlist/wishlist.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => configSchema.parse(env),
    }),
    HealthModule,
    ObservabilityModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    ListingsModule,
    OrdersModule,
    MessagingModule,
    AdminModule,
    ReviewsModule,
    KycModule,
    EscrowModule,
    InventoryModule,
    AuctionsModule,
    StorefrontsModule,
    OffersModule,
    WishlistModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor }],
})
export class AppModule { }
