import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { MessagingController } from './messaging.controller.js';
import { MessagingService } from './messaging.service.js';
import { MessagingGateway } from './messaging.gateway.js';
import { MessageModerationService } from './moderation.service.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [
    PrismaModule,
    HttpModule.register({ timeout: 5000 }),
    MulterModule.register({ storage: memoryStorage() }),
    StorageModule,
  ],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingGateway, MessageModerationService],
  exports: [MessagingService],
})
export class MessagingModule {}
