import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { KycController } from "./kyc.controller";
import { KycService } from "./kyc.service";
import { StorageModule } from "../storage/storage.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PrismaModule, StorageModule, NotificationsModule],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
