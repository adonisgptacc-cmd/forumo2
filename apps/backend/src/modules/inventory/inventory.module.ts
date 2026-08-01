import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { CacheModule } from "../../common/services/cache.module";

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
