import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { LegalController } from "./legal.controller";
import { LegalService } from "./legal.service";
import { AccountDeletionService } from "./account-deletion.service";
import { CacheModule } from "../../common/services/cache.module";

@Module({
  imports: [PrismaModule, NotificationsModule, CacheModule],
  controllers: [LegalController],
  providers: [LegalService, AccountDeletionService],
  exports: [LegalService, AccountDeletionService],
})
export class LegalModule {}
