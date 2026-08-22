import { Module } from "@nestjs/common";
import { OffersService } from "./offers.service";
import { OffersController } from "./offers.controller";
import { PrismaModule } from "../../prisma/prisma.module";
import { CacheModule } from "../../common/services/cache.module";
import { FeesModule } from "../fees/fees.module";

@Module({
  imports: [PrismaModule, CacheModule, FeesModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
