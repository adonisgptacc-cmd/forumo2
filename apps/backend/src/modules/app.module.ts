import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import IORedis from "ioredis";

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
import { PayoutsModule } from "./payouts/payouts.module";
import { CartModule } from "./cart/cart.module";
import { FeesModule } from "./fees/fees.module";
import { ReturnsModule } from "./returns/returns.module";
import { ShippingModule } from "./shipping/shipping.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { LegalModule } from "./legal/legal.module";
import { TosInterceptor } from "../common/interceptors/tos.interceptor";
import { ThrottlerStorageRedis } from "../common/services/throttler-redis.storage";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => configSchema.parse(env),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl =
          config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
        const authLimit = Number(config.get<string>("AUTH_RATE_LIMIT") ?? 10);
        const authWindowSec = Math.ceil(
          Number(config.get<string>("AUTH_RATE_WINDOW_MS") ?? 60_000) / 1000,
        );
        const loginLimit = Number(
          config.get<string>("LOGIN_ATTEMPT_LIMIT") ?? 5,
        );
        const loginWindowSec = Math.ceil(
          Number(config.get<string>("LOGIN_ATTEMPT_WINDOW_MS") ?? 900_000) /
            1000,
        );
        const otpLimit = Number(
          config.get<string>("OTP_DEVICE_RATE_LIMIT") ?? 5,
        );
        const otpWindowSec = Number(
          config.get<string>("OTP_DEVICE_RATE_WINDOW") ?? 300,
        );
        const resendLimit = Number(
          config.get<string>("RESEND_RATE_LIMIT") ?? 3,
        );
        const resendWindowSec = Math.ceil(
          Number(config.get<string>("RESEND_RATE_WINDOW_MS") ?? 3_600_000) /
            1000,
        );
        const paymentLimit = Number(
          config.get<string>("PAYMENT_RATE_LIMIT") ?? 30,
        );
        const paymentWindowSec = Math.ceil(
          Number(config.get<string>("PAYMENT_RATE_WINDOW_MS") ?? 60_000) / 1000,
        );

        return {
          throttlers: [
            { ttl: 60, limit: 100 },
            { name: "auth", ttl: authWindowSec, limit: authLimit },
            { name: "auth-login", ttl: loginWindowSec, limit: loginLimit },
            { name: "auth-otp", ttl: otpWindowSec, limit: otpLimit },
            { name: "auth-resend", ttl: resendWindowSec, limit: resendLimit },
            {
              name: "auth-password-reset",
              ttl: loginWindowSec,
              limit: loginLimit,
            },
            { name: "payments", ttl: paymentWindowSec, limit: paymentLimit },
            { name: "notifications-list", ttl: 60, limit: 60 },
            { name: "notifications-mark", ttl: 60, limit: 30 },
          ],
          storage: new ThrottlerStorageRedis(new IORedis(redisUrl)),
        };
      },
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
    PayoutsModule,
    CartModule,
    FeesModule,
    ReturnsModule,
    ShippingModule,
    AnalyticsModule,
    LegalModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TosInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
