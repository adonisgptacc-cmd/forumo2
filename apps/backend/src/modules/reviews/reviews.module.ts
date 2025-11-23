import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { ReviewModerationService } from './moderation.service.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewModerationService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
