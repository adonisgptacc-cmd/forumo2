import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { EscrowController } from "./escrow.controller";
import { EscrowService } from "./escrow.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { EscrowAutoReleaseProcessor } from "./escrow-auto-release.processor";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [EscrowController],
  providers: [EscrowService, EscrowAutoReleaseProcessor],
  exports: [EscrowService, EscrowAutoReleaseProcessor],
})
export class EscrowModule {}
