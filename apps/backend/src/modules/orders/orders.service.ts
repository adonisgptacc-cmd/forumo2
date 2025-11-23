import { randomUUID } from 'crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EscrowStatus,
  EscrowTransactionType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import type { CreateOrderDto as CreateOrderInput } from './dto/create-order.dto.js';
import type { UpdateOrderStatusDto as UpdateOrderStatusInput } from './dto/update-order-status.dto.js';
import { OrderWithRelations, SafeOrder, serializeOrder } from './order.serializer.js';

import { PrismaService } from '../../prisma/prisma.service.js';
import { PaymentsService } from './payments.service.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async findAll(): Promise<SafeOrder[]> {
    const orders = (await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude,
    })) as OrderWithRelations[];
    return orders.map((order) => serializeOrder(order));
  }

  async findById(id: string): Promise<SafeOrder> {
    const order = (await this.prisma.order.findFirst({
      where: { id },
      include: this.defaultInclude,
    })) as OrderWithRelations | null;
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return serializeOrder(order);
  }

  async create(dto: CreateOrderInput): Promise<SafeOrder> {
    await Promise.all([this.ensureUserExists(dto.buyerId), this.ensureUserExists(dto.sellerId)]);

    const lineItems = await this.buildOrderItems(dto);
    const totalItemCents = lineItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const currency = dto.currency ?? lineItems[0]?.currency ?? 'USD';

    const shippingCents = dto.shippingCents ?? 0;
    const feeCents = dto.feeCents ?? 0;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          buyerId: dto.buyerId,
          sellerId: dto.sellerId,
          totalItemCents,
          shippingCents,
          feeCents,
          currency,
          shippingAddressId: dto.shippingAddressId ?? null,
          billingAddressId: dto.billingAddressId ?? null,
          metadata: this.toJsonInput(dto.metadata),
          placedAt: new Date(),
          items: { create: lineItems },
          timeline: {
            create: [{ status: OrderStatus.PENDING, note: 'Order created' }],
          },
        },
      });

      const totalChargeCents = this.getOrderTotalCents(created);
      const paymentIntent = await this.paymentsService.mintPaymentIntent(created.id, totalChargeCents, created.currency);

      await tx.paymentTransaction.create({
        data: {
          orderId: created.id,
          provider: PaymentProvider.STRIPE,
          status: PaymentStatus.PENDING,
          providerStatus: paymentIntent.status,
          amountCents: totalChargeCents,
          currency: created.currency,
          providerRef: paymentIntent.id,
          metadata: this.toJsonInput(
            paymentIntent.client_secret ? { clientSecret: paymentIntent.client_secret } : undefined,
          ),
        },
      });

      return created;
    });

    return this.findById(order.id);
  }

  async updateStatus(id: string, dto: UpdateOrderStatusInput): Promise<SafeOrder> {
    return this.prisma.$transaction(async (tx) => {
      const order = (await tx.order.findUnique({
        where: { id },
        include: {
          items: true,
          shipments: true,
          timeline: { include: { actor: true } },
          payments: true,
          escrow: { include: { disputes: true, transactions: true } },
        },
      })) as OrderWithRelations | null;

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const timestamps = this.getStatusTimestamps(dto.status);
      const timelineNote = dto.note ?? this.getDefaultTimelineNote(dto.status);
      const metadata = dto.providerStatus ? { providerStatus: dto.providerStatus } : undefined;

      const data: Prisma.OrderUpdateInput = {
        status: dto.status,
        ...timestamps,
        timeline: {
          create: [
            {
              status: dto.status,
              note: timelineNote,
              actorId: dto.actorId ?? null,
              metadata: this.toJsonInput(metadata),
            },
          ],
        },
      };

      const providerStatus = dto.providerStatus ?? undefined;

      switch (dto.status) {
        case OrderStatus.PAID:
          await this.paymentsService.markPaymentCaptured(tx, order, providerStatus);
          await this.ensureEscrowHolding(tx, order);
          data.paymentStatus = PaymentStatus.CAPTURED;
          break;
        case OrderStatus.CANCELLED:
        case OrderStatus.REFUNDED:
          await this.paymentsService.markPaymentRefunded(tx, order, providerStatus);
          await this.handleEscrowRefund(tx, order, dto);
          data.paymentStatus = PaymentStatus.REFUNDED;
          break;
        case OrderStatus.COMPLETED:
          await this.handleEscrowRelease(tx, order, dto);
          break;
        default:
          break;
      }

      const updated = (await tx.order.update({
        where: { id },
        data,
        include: this.defaultInclude,
      })) as OrderWithRelations;

      return serializeOrder(updated);
    });
  }

  private async buildOrderItems(dto: CreateOrderInput) {
    if (!dto.items.length) {
      throw new BadRequestException('At least one line item is required');
    }

    const listingIds = dto.items.map((item) => item.listingId);
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: listingIds }, deletedAt: null },
      select: {
        id: true,
        sellerId: true,
        title: true,
        priceCents: true,
        currency: true,
        variants: {
          select: { id: true, label: true, priceCents: true, currency: true },
        },
      },
    });

    const listingMap = new Map(listings.map((listing) => [listing.id, listing]));
    const currencySet = new Set<string>();

    const items = dto.items.map((item) => {
      const listing = listingMap.get(item.listingId);
      if (!listing) {
        throw new NotFoundException(`Listing ${item.listingId} not found`);
      }
      if (listing.sellerId !== dto.sellerId) {
        throw new BadRequestException('All listings must belong to the provided seller');
      }

      const quantity = item.quantity ?? 1;
      if (quantity <= 0) {
        throw new BadRequestException('Quantity must be positive');
      }

      let unitPriceCents = listing.priceCents;
      let currency = listing.currency;
      let variantLabel: string | null = null;

      if (item.variantId) {
        const variant = listing.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          throw new BadRequestException('Variant not found for listing');
        }
        unitPriceCents = variant.priceCents;
        currency = variant.currency;
        variantLabel = variant.label;
      }

      currencySet.add(currency);

      return {
        listingId: listing.id,
        listingTitle: listing.title,
        variantId: item.variantId ?? null,
        variantLabel,
        quantity,
        unitPriceCents,
        currency,
      } satisfies Prisma.OrderItemUncheckedCreateWithoutOrderInput;
    });

    if (currencySet.size > 1) {
      throw new BadRequestException('All items must share the same currency');
    }

    if (dto.currency && !currencySet.has(dto.currency)) {
      throw new BadRequestException('Order currency does not match line items');
    }

    return items;
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
  }

  private getStatusTimestamps(status: OrderStatus): Prisma.OrderUpdateInput {
    const now = new Date();
    switch (status) {
      case OrderStatus.PAID:
        return { paidAt: now };
      case OrderStatus.FULFILLED:
        return { fulfilledAt: now };
      case OrderStatus.DELIVERED:
        return { deliveredAt: now };
      case OrderStatus.CANCELLED:
        return { cancelledAt: now };
      case OrderStatus.REFUNDED:
        return { cancelledAt: now };
      case OrderStatus.COMPLETED:
        return { deliveredAt: now };
      default:
        return {};
    }
  }

  private getDefaultTimelineNote(status: OrderStatus): string | null {
    switch (status) {
      case OrderStatus.COMPLETED:
        return 'Escrow released to seller';
      case OrderStatus.CANCELLED:
      case OrderStatus.REFUNDED:
        return 'Escrow refunded to buyer';
      default:
        return null;
    }
  }

  private async ensureEscrowHolding(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      escrow: { id: string } | null;
      totalItemCents: number;
      shippingCents: number;
      feeCents: number;
      currency: string;
    },
  ): Promise<void> {
    if (order.escrow) {
      return;
    }

    await tx.escrowHolding.create({
      data: {
        orderId: order.id,
        status: EscrowStatus.HOLDING,
        amountCents: this.getOrderTotalCents(order),
        currency: order.currency,
      },
    });
  }

  private async handleEscrowRelease(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      escrow: { id: string; status: EscrowStatus; amountCents: number; currency: string } | null;
    },
    dto: UpdateOrderStatusInput,
  ): Promise<void> {
    const escrow =
      order.escrow ??
      (await tx.escrowHolding.findUnique({ where: { orderId: order.id } })) ??
      null;
    if (!escrow || escrow.status === EscrowStatus.RELEASED) {
      return;
    }

    const releasedAt = new Date();
    await tx.escrowHolding.update({
      where: { id: escrow.id },
      data: { status: EscrowStatus.RELEASED, releasedAt },
    });

    await tx.escrowTransaction.create({
      data: {
        escrowId: escrow.id,
        type: EscrowTransactionType.RELEASE,
        amountCents: escrow.amountCents,
        currency: escrow.currency,
        note: 'Escrow released to seller',
        actorId: dto.actorId ?? null,
        metadata: this.toJsonInput({ orderId: order.id }),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: dto.actorId ?? null,
        action: 'order.escrow.release',
        entityType: 'order',
        entityId: order.id,
        payload:
          this.toJsonInput({ amountCents: escrow.amountCents, currency: escrow.currency }) ?? Prisma.JsonNull,
      },
    });
  }

  private async handleEscrowRefund(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      escrow: { id: string; status: EscrowStatus; amountCents: number; currency: string } | null;
    },
    dto: UpdateOrderStatusInput,
  ): Promise<void> {
    const escrow =
      order.escrow ??
      (await tx.escrowHolding.findUnique({ where: { orderId: order.id } })) ??
      null;
    if (!escrow || escrow.status === EscrowStatus.REFUNDED) {
      return;
    }

    await tx.escrowHolding.update({
      where: { id: escrow.id },
      data: { status: EscrowStatus.REFUNDED, releasedAt: new Date() },
    });

    await tx.escrowTransaction.create({
      data: {
        escrowId: escrow.id,
        type: EscrowTransactionType.REFUND,
        amountCents: escrow.amountCents,
        currency: escrow.currency,
        note: 'Escrow refunded to buyer',
        actorId: dto.actorId ?? null,
        metadata: this.toJsonInput({ orderId: order.id }),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: dto.actorId ?? null,
        action: 'order.escrow.refund',
        entityType: 'order',
        entityId: order.id,
        payload:
          this.toJsonInput({ amountCents: escrow.amountCents, currency: escrow.currency }) ?? Prisma.JsonNull,
      },
    });
  }

  private getOrderTotalCents(order: {
    totalItemCents: number;
    shippingCents: number;
    feeCents: number;
  }): number {
    return order.totalItemCents + order.shippingCents + order.feeCents;
  }

  private toJsonInput(
    value?: Record<string, unknown> | null,
  ): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
  }

  private generateOrderNumber(): string {
    return `ORD-${randomUUID().split('-')[0].toUpperCase()}`;
  }

  private get defaultInclude() {
    return {
      items: true,
      shipments: true,
      timeline: { orderBy: { createdAt: 'asc' }, include: { actor: true } },
      payments: { orderBy: { createdAt: 'desc' } },
      escrow: {
        include: {
          disputes: true,
          transactions: true,
        },
      },
    } satisfies Prisma.OrderInclude;
  }
}
