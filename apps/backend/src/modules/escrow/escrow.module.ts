import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [PrismaModule, NotificationsModule],
    controllers: [EscrowController],
    providers: [EscrowService],
    exports: [EscrowService],
})
export class EscrowModule { }
