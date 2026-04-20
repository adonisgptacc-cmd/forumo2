import {
    Controller,
    Post,
    Get,
    Patch,
    Body,
    Param,
    UseGuards,
    Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
    constructor(private readonly inventoryService: InventoryService) { }

    @Get('variant/:variantId')
    async getInventory(@Param('variantId') variantId: string) {
        return this.inventoryService.getInventoryByVariant(variantId);
    }

    @Post('variant/:variantId/add')
    @UseGuards(RolesGuard)
    @Roles('SELLER', 'ADMIN')
    async addStock(
        @Param('variantId') variantId: string,
        @Body() body: { quantity: number; location?: string; metadata?: any },
    ) {
        return this.inventoryService.addStock(
            variantId,
            body.quantity,
            body.location,
            body.metadata,
        );
    }

    @Post('variant/:variantId/reserve')
    async reserveStock(
        @Param('variantId') variantId: string,
        @Body() body: { quantity: number; orderId: string },
    ) {
        return this.inventoryService.reserveStock(variantId, body.quantity, body.orderId);
    }

    @Patch('reservations/:reservationId/confirm')
    async confirmReservation(@Param('reservationId') reservationId: string) {
        return this.inventoryService.confirmReservation(reservationId);
    }

    @Patch('reservations/:reservationId/release')
    async releaseReservation(@Param('reservationId') reservationId: string) {
        return this.inventoryService.releaseReservation(reservationId);
    }

    @Post('items/:itemId/damage')
    @UseGuards(RolesGuard)
    @Roles('SELLER', 'ADMIN')
    async markDamaged(
        @Param('itemId') itemId: string,
        @Body() body: { quantity: number; reason?: string },
    ) {
        return this.inventoryService.markDamaged(itemId, body.quantity, body.reason);
    }

    @Post('variant/:variantId/adjust')
    @UseGuards(RolesGuard)
    @Roles('SELLER', 'ADMIN')
    async adjustStock(
        @Param('variantId') variantId: string,
        @Body() body: { adjustment: number; reason: string },
    ) {
        return this.inventoryService.adjustStock(variantId, body.adjustment, body.reason);
    }

    @Get('orders/:orderId/reservations')
    async getOrderReservations(@Param('orderId') orderId: string) {
        return this.inventoryService.getReservationsByOrder(orderId);
    }

    @Post('cleanup-expired')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    async cleanupExpired() {
        return this.inventoryService.cleanupExpiredReservations();
    }
}
