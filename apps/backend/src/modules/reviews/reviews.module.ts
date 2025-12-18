import { Module } from '@nestjs/common';

import { PrismaModule } from "../../prisma/prisma.module";
import { UsersModule } from "../users/users.module";
import { ReviewModerationService } from "./moderation.service";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewModerationService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
