import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { OrdersModule } from "../orders/orders.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CacheModule } from "../../common/services/cache.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrdersModule,
    NotificationsModule,
    CacheModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
