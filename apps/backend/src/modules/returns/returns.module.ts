import { Module } from "@nestjs/common";
import { ReturnsService } from "./returns.service";
import { ReturnsController } from "./returns.controller";
import { PrismaModule } from "../../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrdersModule } from "../orders/orders.module";

@Module({
  imports: [PrismaModule, NotificationsModule, OrdersModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
