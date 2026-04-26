import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FeeService } from './fee.service';
import { FeeSchedulesController } from './fee-schedules.controller';
import { FeePreviewController } from './fee-preview.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FeeSchedulesController, FeePreviewController],
  providers: [FeeService],
  exports: [FeeService],
})
export class FeesModule {}
