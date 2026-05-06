import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from "../../prisma/prisma.module";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";
import { MessagingGateway } from "./messaging.gateway";
import { MessageModerationService } from "./moderation.service";
import { StorageModule } from "../storage/storage.module";
import { CacheService } from "../../common/services/cache.service";

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    HttpModule.register({ timeout: 5000 }),
    MulterModule.register({ storage: memoryStorage() }),
    StorageModule,
  ],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingGateway, MessageModerationService, CacheService],
  exports: [MessagingService, MessagingGateway],
})
export class MessagingModule {}
