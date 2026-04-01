import {
    Controller,
    Post,
    Get,
    Patch,
    Body,
    Param,
    UseGuards,
    Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EscrowService } from './escrow.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('escrow')
@Controller('escrow')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EscrowController {
    constructor(private readonly escrowService: EscrowService) { }

    @Get('order/:orderId')
    async getEscrowByOrder(@Param('orderId') orderId: string) {
        return this.escrowService.getEscrowByOrderId(orderId);
    }

    @Post('order/:orderId/release')
    @UseGuards(RolesGuard)
    @Roles('ADMIN', 'MODERATOR')
    async releaseEscrow(
        @Param('orderId') orderId: string,
        @Request() req: any,
        @Body() body: { note?: string },
    ) {
        return this.escrowService.releaseEscrow(orderId, req.user.id, body.note);
    }

    @Post('order/:orderId/refund')
    @UseGuards(RolesGuard)
    @Roles('ADMIN', 'MODERATOR')
    async refundEscrow(
        @Param('orderId') orderId: string,
        @Request() req: any,
        @Body() body: { amountCents?: number; note?: string },
    ) {
        return this.escrowService.refundEscrow(orderId, req.user.id, body.amountCents, body.note);
    }

    @Post('order/:orderId/dispute')
    async openDispute(
        @Param('orderId') orderId: string,
        @Request() req: any,
        @Body() body: { reason: string },
    ) {
        return this.escrowService.openDispute(orderId, req.user.id, body.reason);
    }

    @Patch('disputes/:disputeId/resolve')
    @UseGuards(RolesGuard)
    @Roles('ADMIN', 'MODERATOR')
    async resolveDispute(
        @Param('disputeId') disputeId: string,
        @Request() req: any,
        @Body()
        body: {
            resolution: string;
            action: 'RELEASE' | 'REFUND' | 'PARTIAL_REFUND';
            refundAmountCents?: number;
        },
    ) {
        return this.escrowService.resolveDispute(
            disputeId,
            req.user.id,
            body.resolution,
            body.action,
            body.refundAmountCents,
        );
    }

    @Post('disputes/:disputeId/messages')
    async addDisputeMessage(
        @Param('disputeId') disputeId: string,
        @Request() req: any,
        @Body() body: { body: string; attachments?: any },
    ) {
        return this.escrowService.addDisputeMessage(
            disputeId,
            req.user.id,
            body.body,
            body.attachments,
        );
    }

    @Get('disputes')
    @UseGuards(RolesGuard)
    @Roles('ADMIN', 'MODERATOR')
    async listDisputes() {
        return this.escrowService.listActiveDisputes();
    }
}
