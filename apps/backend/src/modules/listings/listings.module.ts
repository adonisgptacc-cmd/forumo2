import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { ListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';
import { ModerationQueueService } from './moderation-queue.service.js';
import { ListingSearchService } from './search.service.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [
    PrismaModule,
    HttpModule.register({ timeout: 5000 }),
    MulterModule.register({ storage: memoryStorage() }),
    StorageModule,
  ],
  controllers: [ListingsController],
  providers: [ListingsService, ListingSearchService, ModerationQueueService],
  exports: [ListingsService, ListingSearchService, ModerationQueueService],
})
export class ListingsModule {}
