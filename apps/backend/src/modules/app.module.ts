import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { AdminModule } from './admin/admin.module.js';
import { configSchema } from '../config/config.schema.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { HttpMetricsInterceptor } from '../common/interceptors/http-metrics.interceptor.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => configSchema.parse(env),
    }),
    HealthModule,
    ObservabilityModule,
    AuthModule,
    UsersModule,
    ListingsModule,
    OrdersModule,
    MessagingModule,
    AdminModule,
    ReviewsModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor }],
})
export class AppModule {}
