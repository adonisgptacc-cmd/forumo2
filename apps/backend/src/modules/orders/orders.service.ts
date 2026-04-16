import { randomUUID } from 'crypto';

import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  EscrowStatus,
  EscrowTransactionType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import type { CreateOrderDto as CreateOrderInput } from "./dto/create-order.dto";
import type { UpdateOrderStatusDto as UpdateOrderStatusInput } from "./dto/update-order-status.dto";
import { OrderWithRelations, SafeOrder, serializeOrder } from "./order.serializer";

import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "./payments.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly notifications: NotificationsService,
  ) { }

  async findAll(userId: string): Promise<SafeOrder[]> {
    const orders = (await this.prisma.order.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude,
    })) as OrderWithRelations[];
    return orders.map((order) => serializeOrder(order));
  }

  async findById(id: string, userId?: string): Promise<SafeOrder> {
    const order = (await this.prisma.order.findFirst({
      where: { id },
      include: this.defaultInclude,
    })) as OrderWithRelations | null;
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (userId && order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('Access denied');
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

  async initiatePayment(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true }
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId !== userId) throw new ForbiddenException('Not your order');
    if (order.status !== OrderStatus.PENDING) throw new BadRequestException('Order status not pending');

    // Check for existing pending intent
    const existing = order.payments.find(p => p.status === PaymentStatus.PENDING && p.provider === PaymentProvider.STRIPE);
    if (existing && existing.metadata && (existing.metadata as any).clientSecret) {
      return { clientSecret: (existing.metadata as any).clientSecret };
    }

    // Create new intent
    const totalChargeCents = order.totalItemCents + order.shippingCents + order.feeCents;
    const paymentIntent = await this.paymentsService.mintPaymentIntent(order.id, totalChargeCents, order.currency);

    await this.prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.PENDING,
        providerStatus: paymentIntent.status,
        amountCents: totalChargeCents,
        currency: order.currency,
        providerRef: paymentIntent.id,
        metadata: this.toJsonInput(
          paymentIntent.client_secret ? { clientSecret: paymentIntent.client_secret } : undefined,
        ),
      },
    });

    return { clientSecret: paymentIntent.client_secret };
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
          // Issue Stripe refund outside the transaction (non-fatal if it fails)
          void this.paymentsService.issueStripeRefund(order.id, 'requested_by_customer');
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

      const serialized = serializeOrder(updated);

      // Fire email notifications outside the transaction (non-blocking, non-fatal)
      void this.fireOrderNotifications(serialized, dto.status).catch(() => undefined);

      return serialized;
    });
  }

  /** Fire transactional emails for key order status transitions. Never throws. */
  private async fireOrderNotifications(order: SafeOrder, status: OrderStatus): Promise<void> {
    try {
      const [buyer, seller] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: order.buyerId }, select: { id: true, email: true, name: true } }),
        this.prisma.user.findUnique({ where: { id: order.sellerId }, select: { id: true, email: true, name: true } }),
      ]);
      if (!buyer || !seller) return;

      const ref = order.orderNumber;
      const total = `${order.currency} ${(order.totalItemCents / 100).toFixed(2)}`;
      const orderUrl = `${process.env.APP_URL ?? ''}/app/orders/${order.id}`;

      switch (status) {
        case OrderStatus.CONFIRMED:
          await Promise.all([
            this.notifications.sendEmail(
              buyer.email,
              `Order confirmed — ${ref}`,
              `<p>Hi ${buyer.name},</p><p>Your order <strong>${ref}</strong> has been confirmed by the seller. Total: ${total}.</p><p><a href="${orderUrl}">View your order</a></p>`,
            ),
            this.notifications.sendEmail(
              seller.email,
              `New order received — ${ref}`,
              `<p>Hi ${seller.name},</p><p>You have a new confirmed order <strong>${ref}</strong>. Total: ${total}.</p><p><a href="${orderUrl}">Manage this order</a></p>`,
            ),
            this.notifications.createInApp(buyer.id, 'order.confirmed', { orderId: order.id, ref }),
          ]);
          break;

        case OrderStatus.PAID:
          await Promise.all([
            this.notifications.sendEmail(
              seller.email,
              `Payment received — ${ref}`,
              `<p>Hi ${seller.name},</p><p>Payment for order <strong>${ref}</strong> (${total}) has been captured and is held in escrow. Please ship the item and update tracking.</p><p><a href="${orderUrl}">View order</a></p>`,
            ),
            this.notifications.createInApp(seller.id, 'order.paid', { orderId: order.id, ref }),
          ]);
          break;

        case OrderStatus.FULFILLED:
          await Promise.all([
            this.notifications.sendEmail(
              buyer.email,
              `Your order has shipped — ${ref}`,
              `<p>Hi ${buyer.name},</p><p>Your order <strong>${ref}</strong> has been shipped. Check your order page for tracking details.</p><p><a href="${orderUrl}">Track your order</a></p>`,
            ),
            this.notifications.createInApp(buyer.id, 'order.shipped', { orderId: order.id, ref }),
          ]);
          break;

        case OrderStatus.DELIVERED:
          await Promise.all([
            this.notifications.sendEmail(
              buyer.email,
              `Confirm delivery — ${ref}`,
              `<p>Hi ${buyer.name},</p><p>Your order <strong>${ref}</strong> has been marked as delivered. Please confirm receipt to release payment to the seller.</p><p><a href="${orderUrl}">Confirm delivery</a></p>`,
            ),
            this.notifications.createInApp(buyer.id, 'order.delivered', { orderId: order.id, ref }),
          ]);
          break;

        case OrderStatus.COMPLETED:
          await Promise.all([
            this.notifications.sendEmail(
              seller.email,
              `Funds released — ${ref}`,
              `<p>Hi ${seller.name},</p><p>The buyer has confirmed delivery for order <strong>${ref}</strong>. ${total} has been released from escrow to your account.</p>`,
            ),
            this.notifications.sendEmail(
              buyer.email,
              `Order complete — ${ref}`,
              `<p>Hi ${buyer.name},</p><p>Your order <strong>${ref}</strong> is complete. Thank you for shopping on Forumo!</p>`,
            ),
          ]);
          break;

        case OrderStatus.CANCELLED:
          await Promise.all([
            this.notifications.sendEmail(
              buyer.email,
              `Order cancelled — ${ref}`,
              `<p>Hi ${buyer.name},</p><p>Your order <strong>${ref}</strong> has been cancelled. Any payment will be refunded shortly.</p>`,
            ),
            this.notifications.sendEmail(
              seller.email,
              `Order cancelled — ${ref}`,
              `<p>Hi ${seller.name},</p><p>Order <strong>${ref}</strong> has been cancelled.</p>`,
            ),
          ]);
          break;

        case OrderStatus.DISPUTED:
          await Promise.all([
            this.notifications.sendEmail(
              seller.email,
              `Dispute opened — ${ref}`,
              `<p>Hi ${seller.name},</p><p>A dispute has been raised for order <strong>${ref}</strong>. An admin will review shortly. <a href="${orderUrl}">View dispute</a></p>`,
            ),
            this.notifications.createInApp(seller.id, 'order.disputed', { orderId: order.id, ref }),
            this.notifications.createInApp(buyer.id, 'order.disputed', { orderId: order.id, ref }),
          ]);
          break;

        default:
          break;
      }
    } catch {
      // swallow — notifications must never break the order flow
    }
  }

  async updateStatusFromProvider(id: string, dto: UpdateOrderStatusInput): Promise<SafeOrder | null> {
    const existing = await this.prisma.order.findUnique({ where: { id }, select: { status: true } });
    if (!existing) {
      return null;
    }

    if (existing.status === dto.status) {
      if (dto.providerStatus) {
        await this.paymentsService.updateProviderStatus(id, dto.providerStatus);
      }
      return this.findById(id);
    }

    return this.updateStatus(id, dto);
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
        return {}; // No dedicated completedAt field; deliveredAt was already set at DELIVERED
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

  async getSellerAnalytics(sellerId: string) {
    const orders = await this.prisma.order.findMany({
      where: { sellerId },
      select: {
        id: true,
        status: true,
        totalItemCents: true,
        shippingCents: true,
        feeCents: true,
        currency: true,
        placedAt: true,
        createdAt: true,
      },
    });

    // Only COMPLETED means escrow was released to seller — DELIVERED is still in-flight
    const completedOrders = orders.filter((o) => o.status === 'COMPLETED');

    const totalRevenueCents = completedOrders.reduce(
      (sum, o) => sum + o.totalItemCents + o.shippingCents + o.feeCents,
      0,
    );

    const ordersByStatus: Record<string, number> = {};
    for (const o of orders) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
    }

    // Group revenue by month (last 12 months)
    const now = new Date();
    const revenueByMonth: { month: string; revenueCents: number; orderCount: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
      const monthOrders = completedOrders.filter((o) => {
        const placed = new Date(o.placedAt ?? o.createdAt);
        return placed.getFullYear() === d.getFullYear() && placed.getMonth() === d.getMonth();
      });
      revenueByMonth.push({
        month: label,
        revenueCents: monthOrders.reduce((s, o) => s + o.totalItemCents + o.shippingCents + o.feeCents, 0),
        orderCount: monthOrders.length,
      });
    }

    const avgOrderValueCents = completedOrders.length
      ? Math.round(totalRevenueCents / completedOrders.length)
      : 0;

    return {
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      totalRevenueCents,
      avgOrderValueCents,
      ordersByStatus,
      revenueByMonth,
    };
  }

  async createShipment(
    orderId: string,
    actorId: string,
    dto: {
      carrier?: string;
      trackingNumber?: string;
      serviceLevel?: string;
      estimatedDelivery?: string;
    },
  ) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.sellerId !== actorId) throw new ForbiddenException('Only the seller can add shipment info');

    const existing = await this.prisma.orderShipment.findFirst({ where: { orderId } });
    if (existing) throw new BadRequestException('Shipment already exists. Use PATCH to update.');

    return this.prisma.orderShipment.create({
      data: {
        orderId,
        carrier: dto.carrier,
        trackingNumber: dto.trackingNumber,
        serviceLevel: dto.serviceLevel,
        estimatedDelivery: dto.estimatedDelivery ? new Date(dto.estimatedDelivery) : undefined,
        status: 'IN_TRANSIT',
      },
    });
  }

  async updateShipment(
    orderId: string,
    actorId: string,
    dto: {
      carrier?: string;
      trackingNumber?: string;
      serviceLevel?: string;
      status?: string;
      estimatedDelivery?: string;
      deliveredAt?: string;
    },
  ) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.sellerId !== actorId) throw new ForbiddenException('Only the seller can update shipment info');

    const shipment = await this.prisma.orderShipment.findFirst({ where: { orderId } });
    if (!shipment) throw new NotFoundException('No shipment found for this order');

    return this.prisma.orderShipment.update({
      where: { id: shipment.id },
      data: {
        ...(dto.carrier !== undefined && { carrier: dto.carrier }),
        ...(dto.trackingNumber !== undefined && { trackingNumber: dto.trackingNumber }),
        ...(dto.serviceLevel !== undefined && { serviceLevel: dto.serviceLevel }),
        ...(dto.status !== undefined && { status: dto.status as any }),
        ...(dto.estimatedDelivery !== undefined && { estimatedDelivery: new Date(dto.estimatedDelivery) }),
        ...(dto.deliveredAt !== undefined && { deliveredAt: new Date(dto.deliveredAt) }),
      },
    });
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
