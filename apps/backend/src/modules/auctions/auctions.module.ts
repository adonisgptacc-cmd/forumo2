import { Module } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';
import { PrismaModule } from '../../prisma/prisma.module';

import { AuctionsGateway } from './auctions.gateway';

import { ScheduleModule } from '@nestjs/schedule';
import { AuctionEndProcessor } from './processors/auction-end.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [PrismaModule, ScheduleModule.forRoot(), NotificationsModule],
    controllers: [AuctionsController],
    providers: [AuctionsService, AuctionsGateway, AuctionEndProcessor],
    exports: [AuctionsService],
})
export class AuctionsModule { }
