import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EscrowStatus, DisputeStatus, EscrowTransactionType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EscrowService {
    private readonly logger = new Logger(EscrowService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
    ) { }

    async createEscrowHolding(orderId: string, amountCents: number, currency: string = 'USD') {
        // Check if escrow already exists for this order
        const existing = await this.prisma.escrowHolding.findUnique({
            where: { orderId },
        });

        if (existing) {
            throw new BadRequestException('Escrow already exists for this order');
        }

        // Create escrow holding
        const escrow = await this.prisma.escrowHolding.create({
            data: {
                orderId,
                amountCents,
                currency,
                status: 'HOLDING',
                releaseAfter: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days default
            },
        });

        return escrow;
    }

    async getEscrowByOrderId(orderId: string) {
        const escrow = await this.prisma.escrowHolding.findUnique({
            where: { orderId },
            include: {
                disputes: {
                    include: {
                        openedBy: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                            },
                        },
                        messages: {
                            include: {
                                author: {
                                    select: {
                                        id: true,
                                        email: true,
                                        name: true,
                                    },
                                },
                            },
                            orderBy: {
                                createdAt: 'asc',
                            },
                        },
                    },
                },
                transactions: {
                    include: {
                        actor: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
            },
        });

        if (!escrow) {
            throw new NotFoundException('Escrow not found');
        }

        return escrow;
    }

    async releaseEscrow(orderId: string, actorId: string, note?: string) {
        const escrow = await this.prisma.escrowHolding.findUnique({
            where: { orderId },
        });

        if (!escrow) {
            throw new NotFoundException('Escrow not found');
        }

        if (escrow.status !== 'HOLDING') {
            throw new BadRequestException(`Cannot release escrow with status: ${escrow.status}`);
        }

        // Update escrow status
        const updated = await this.prisma.escrowHolding.update({
            where: { orderId },
            data: {
                status: 'RELEASED',
                releasedAt: new Date(),
            },
        });

        // Create transaction record
        await this.prisma.escrowTransaction.create({
            data: {
                escrowId: escrow.id,
                type: 'RELEASE',
                amountCents: escrow.amountCents,
                currency: escrow.currency,
                actorId,
                note: note || 'Funds released to seller',
            },
        });

        this.logger.warn(
            `[PAYOUT PENDING] Escrow for order ${orderId} released. ` +
            `Seller payout of ${escrow.amountCents} ${escrow.currency} must be triggered via payment provider. ` +
            `Integrate Stripe Connect transfer or equivalent before going live.`,
        );

        const releaseOrder = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { seller: { select: { email: true, name: true } } },
        });
        if (releaseOrder?.seller) {
            await this.notifications.notifyEscrowReleased(
                releaseOrder.seller.email,
                releaseOrder.seller.name ?? 'Seller',
                orderId,
                escrow.amountCents,
                escrow.currency,
            );
        }

        return updated;
    }

    async refundEscrow(orderId: string, actorId: string, amountCents?: number, note?: string) {
        const escrow = await this.prisma.escrowHolding.findUnique({
            where: { orderId },
        });

        if (!escrow) {
            throw new NotFoundException('Escrow not found');
        }

        if (escrow.status !== 'HOLDING' && escrow.status !== 'DISPUTED') {
            throw new BadRequestException(`Cannot refund escrow with status: ${escrow.status}`);
        }

        const refundAmount = amountCents || escrow.amountCents;

        if (refundAmount > escrow.amountCents) {
            throw new BadRequestException('Refund amount exceeds escrow amount');
        }

        // Update escrow status
        const updated = await this.prisma.escrowHolding.update({
            where: { orderId },
            data: {
                status: 'REFUNDED',
            },
        });

        // Create transaction record
        await this.prisma.escrowTransaction.create({
            data: {
                escrowId: escrow.id,
                type: 'REFUND',
                amountCents: refundAmount,
                currency: escrow.currency,
                actorId,
                note: note || 'Funds refunded to buyer',
            },
        });

        this.logger.warn(
            `[REFUND PENDING] Escrow for order ${orderId} marked refunded. ` +
            `Buyer refund of ${refundAmount} ${escrow.currency} must be triggered via payment provider. ` +
            `Integrate Stripe refund or equivalent before going live.`,
        );

        const refundOrder = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { buyer: { select: { email: true, name: true } } },
        });
        if (refundOrder?.buyer) {
            await this.notifications.notifyEscrowRefunded(
                refundOrder.buyer.email,
                refundOrder.buyer.name ?? 'Buyer',
                orderId,
                refundAmount,
                escrow.currency,
            );
        }

        return updated;
    }

    async openDispute(orderId: string, openedById: string, reason: string) {
        const escrow = await this.prisma.escrowHolding.findUnique({
            where: { orderId },
        });

        if (!escrow) {
            throw new NotFoundException('Escrow not found');
        }

        if (escrow.status !== 'HOLDING') {
            throw new BadRequestException('Can only dispute escrow that is holding funds');
        }

        // Update escrow status
        await this.prisma.escrowHolding.update({
            where: { orderId },
            data: {
                status: 'DISPUTED',
            },
        });

        // Create dispute
        const dispute = await this.prisma.escrowDispute.create({
            data: {
                escrowId: escrow.id,
                openedById,
                reason,
                status: 'OPEN',
            },
            include: {
                openedBy: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        await this.notifications.notifyDisputeOpened(orderId, dispute.id, reason);

        return dispute;
    }

    async resolveDispute(
        disputeId: string,
        actorId: string,
        resolution: string,
        action: 'RELEASE' | 'REFUND' | 'PARTIAL_REFUND',
        refundAmountCents?: number,
    ) {
        const dispute = await this.prisma.escrowDispute.findUnique({
            where: { id: disputeId },
            include: {
                escrow: true,
            },
        });

        if (!dispute) {
            throw new NotFoundException('Dispute not found');
        }

        if (dispute.status === 'RESOLVED') {
            throw new BadRequestException('Dispute already resolved');
        }

        // Update dispute
        await this.prisma.escrowDispute.update({
            where: { id: disputeId },
            data: {
                status: 'RESOLVED',
                resolution,
                resolvedAt: new Date(),
            },
        });

        // Execute action
        if (action === 'RELEASE') {
            await this.releaseEscrow(dispute.escrow.orderId, actorId, `Dispute resolved: ${resolution}`);
        } else if (action === 'REFUND') {
            await this.refundEscrow(dispute.escrow.orderId, actorId, undefined, `Dispute resolved: ${resolution}`);
        } else if (action === 'PARTIAL_REFUND' && refundAmountCents) {
            await this.refundEscrow(dispute.escrow.orderId, actorId, refundAmountCents, `Partial refund: ${resolution}`);
        }

        return this.getEscrowByOrderId(dispute.escrow.orderId);
    }

    async addDisputeMessage(disputeId: string, authorId: string, body: string, attachments?: any) {
        const dispute = await this.prisma.escrowDispute.findUnique({
            where: { id: disputeId },
        });

        if (!dispute) {
            throw new NotFoundException('Dispute not found');
        }

        const message = await this.prisma.disputeMessage.create({
            data: {
                disputeId,
                authorId,
                body,
                attachments: attachments || {},
            },
            include: {
                author: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        return message;
    }

    async listActiveDisputes() {
        return this.prisma.escrowDispute.findMany({
            where: {
                status: { in: ['OPEN', 'UNDER_REVIEW'] },
            },
            include: {
                escrow: {
                    include: {
                        order: {
                            select: {
                                id: true,
                                orderNumber: true,
                                buyer: {
                                    select: {
                                        id: true,
                                        email: true,
                                        name: true,
                                    },
                                },
                                seller: {
                                    select: {
                                        id: true,
                                        email: true,
                                        name: true,
                                    },
                                },
                            },
                        },
                    },
                },
                openedBy: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                openedAt: 'asc',
            },
        });
    }
}
