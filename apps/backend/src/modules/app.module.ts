import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { MessagingModule } from './messaging/messaging.module.js';

@Module({
  imports: [HealthModule, AuthModule, UsersModule, ListingsModule, OrdersModule, MessagingModule],
})
export class AppModule {}
