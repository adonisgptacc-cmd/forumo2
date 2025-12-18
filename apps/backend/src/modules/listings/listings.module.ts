import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { PrismaModule } from "../../prisma/prisma.module";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";
import { ModerationQueueService } from "./moderation-queue.service";
import { ListingSearchService } from "./search.service";
import { StorageModule } from "../storage/storage.module";
import { CacheService } from "../../common/services/cache.service";

@Module({
  imports: [
    PrismaModule,
    HttpModule.register({ timeout: 5000 }),
    MulterModule.register({ storage: memoryStorage() }),
    StorageModule,
  ],
  controllers: [ListingsController],
  providers: [ListingsService, ListingSearchService, ModerationQueueService, CacheService],
  exports: [ListingsService, ListingSearchService, ModerationQueueService],
})
export class ListingsModule {}
