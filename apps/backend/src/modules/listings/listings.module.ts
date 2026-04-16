import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { PrismaModule } from "../../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";
import { ModerationQueueService } from "./moderation-queue.service";
import { LocalSearchService } from "./local-search.service";
import { ListingSearchService } from "./search.service";
import { StorageModule } from "../storage/storage.module";
import { CacheService } from "../../common/services/cache.service";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    HttpModule.register({ timeout: 5000 }),
    MulterModule.register({ storage: memoryStorage() }),
    StorageModule,
    NotificationsModule,
  ],
  controllers: [ListingsController, CategoriesController],
  providers: [ListingsService, ListingSearchService, ModerationQueueService, CacheService, LocalSearchService, CategoriesService],
  exports: [ListingsService, ListingSearchService, ModerationQueueService, CategoriesService],
})
export class ListingsModule { }
