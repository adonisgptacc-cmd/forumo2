import { Module } from '@nestjs/common';
import { StorefrontsService } from './storefronts.service';
import { StorefrontsController } from './storefronts.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [StorefrontsController],
    providers: [StorefrontsService],
    exports: [StorefrontsService],
})
export class StorefrontsModule { }
