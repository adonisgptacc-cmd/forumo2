import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ListingsModule } from "../listings/listings.module";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

@Module({
  imports: [ConfigModule, ListingsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
