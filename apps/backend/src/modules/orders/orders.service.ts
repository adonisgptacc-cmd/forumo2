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
import { PaystackService } from "./paystack.service";
import { PaymentProviderFactory } from "./payment-provider.factory";
import { TaxService, TaxReceiptResult } from "./tax.service";
import { NotificationsService } from "../notifications/notifications.service";
import { FeeService } from "../fees/fee.service";
import { ShippingService } from "../shipping/shipping.service";

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly paystackService: PaystackService,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly taxService: TaxService,
    private readonly notifications: NotificationsService,
    private readonly feeService: FeeService,
    private readonly shippingService: ShippingService,
  ) { }

  async findAll(userId: string, filters?: { listingId?: string; status?: string }): Promise<SafeOrder[]> {
    const where: Record<string, unknown> = { OR: [{ buyerId: userId }, { sellerId: userId }] };
    if (filters?.status) {
      where['status'] = filters.status;
    }
    if (filters?.listingId) {
      where['items'] = { some: { listingId: filters.listingId } };
    }
    const orders = (await this.prisma.order.findMany({
      where,
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

    // Auto-calculate platform fee from the fee schedule (use first listing as proxy for category lookup)
    const primaryListingId = lineItems[0]?.listingId;
    const { feeAmountCents: feeCents, feePercent } = primaryListingId
      ? await this.feeService.calculateFee(totalItemCents, primaryListingId)
      : { feeAmountCents: 0, feePercent: 0 };

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          buyerId: dto.buyerId,
          sellerId: dto.sellerId,
          totalItemCents,
          shippingCents,
          feeCents,
          feePercent,
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
      const provider = this.providerFactory.selectProvider(created.currency);

      const shippingAddr = dto.shippingAddressId
        ? await tx.userAddress.findUnique({ where: { id: dto.shippingAddressId } })
        : null;

      if (provider === 'paystack') {
        const buyer = await tx.user.findUnique({
          where: { id: dto.buyerId },
          select: { email: true },
        });
        const callbackUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/app/checkout/success`;
        const { authorizationUrl, reference } = await this.paystackService.initializeTransaction(
          totalChargeCents,
          buyer?.email ?? '',
          { orderId: created.id },
          callbackUrl,
        );
        await tx.paymentTransaction.create({
          data: {
            orderId: created.id,
            provider: PaymentProvider.PAYSTACK,
            status: PaymentStatus.PENDING,
            providerStatus: 'initialized',
            amountCents: totalChargeCents,
            currency: created.currency,
            providerRef: reference,
            metadata: this.toJsonInput({ authorizationUrl, reference }),
          },
        });
      } else {
        const paymentIntent = await this.paymentsService.mintPaymentIntent(
          created.id,
          totalChargeCents,
          created.currency,
          shippingAddr
            ? {
                shippingAddress: {
                  name: shippingAddr.fullName,
                  line1: shippingAddr.line1,
                  line2: shippingAddr.line2 ?? undefined,
                  city: shippingAddr.city,
                  state: shippingAddr.state ?? undefined,
                  postalCode: shippingAddr.postalCode ?? undefined,
                  country: shippingAddr.country,
                },
              }
            : undefined,
        );
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
      }

      return created;
    });

    return this.findById(order.id);
  }

  async initiatePayment(orderId: string, userId: string): Promise<{
    provider: 'stripe' | 'paystack';
    clientSecret?: string;
    authorizationUrl?: string;
    reference?: string;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId !== userId) throw new ForbiddenException('Not your order');
    if (order.status !== OrderStatus.PENDING) throw new BadRequestException('Order status not pending');

    // Return existing pending Paystack transaction
    const existingPaystack = order.payments.find(
      (p) => p.status === PaymentStatus.PENDING && p.provider === PaymentProvider.PAYSTACK,
    );
    if (existingPaystack?.metadata) {
      const meta = existingPaystack.metadata as Record<string, unknown>;
      if (meta.authorizationUrl) {
        return {
          provider: 'paystack',
          authorizationUrl: meta.authorizationUrl as string,
          reference: existingPaystack.providerRef ?? undefined,
        };
      }
    }

    // Return existing pending Stripe intent
    const existingStripe = order.payments.find(
      (p) => p.status === PaymentStatus.PENDING && p.provider === PaymentProvider.STRIPE,
    );
    if (existingStripe?.metadata) {
      const meta = existingStripe.metadata as Record<string, unknown>;
      if (meta.clientSecret) {
        return { provider: 'stripe', clientSecret: meta.clientSecret as string };
      }
    }

    // No existing pending transaction — create a new one based on currency
    const totalChargeCents = order.totalItemCents + order.shippingCents + order.feeCents;
    const selectedProvider = this.providerFactory.selectProvider(order.currency);

    if (selectedProvider === 'paystack') {
      const buyer = await this.prisma.user.findUnique({
        where: { id: order.buyerId },
        select: { email: true },
      });
      const callbackUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/app/checkout/success`;
      const { authorizationUrl, reference } = await this.paystackService.initializeTransaction(
        totalChargeCents,
        buyer?.email ?? '',
        { orderId: order.id },
        callbackUrl,
      );
      await this.prisma.paymentTransaction.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.PAYSTACK,
          status: PaymentStatus.PENDING,
          providerStatus: 'initialized',
          amountCents: totalChargeCents,
          currency: order.currency,
          providerRef: reference,
          metadata: this.toJsonInput({ authorizationUrl, reference }),
        },
      });
      return { provider: 'paystack', authorizationUrl, reference };
    }

    const shippingAddr = order.shippingAddressId
      ? await this.prisma.userAddress.findUnique({ where: { id: order.shippingAddressId } })
      : null;
    const paymentIntent = await this.paymentsService.mintPaymentIntent(
      order.id,
      totalChargeCents,
      order.currency,
      shippingAddr
        ? {
            shippingAddress: {
              name: shippingAddr.fullName,
              line1: shippingAddr.line1,
              line2: shippingAddr.line2 ?? undefined,
              city: shippingAddr.city,
              state: shippingAddr.state ?? undefined,
              postalCode: shippingAddr.postalCode ?? undefined,
              country: shippingAddr.country,
            },
          }
        : undefined,
    );
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
    return { provider: 'stripe', clientSecret: paymentIntent.client_secret ?? undefined };
  }

  async verifyPaystackPayment(reference: string): Promise<{ verified: boolean; orderId: string; amount: number; reference: string; currency: string }> {
    const tx = await this.prisma.paymentTransaction.findFirst({
      where: { providerRef: reference, provider: PaymentProvider.PAYSTACK },
    });
    if (!tx) throw new NotFoundException('Paystack transaction not found');

    const result = await this.paystackService.verifyTransaction(reference);
    if (!result.success) throw new BadRequestException('Paystack payment verification failed');

    // Guard against underpayment: Paystack returns amounts in kobo (smallest currency unit).
    // Our amountCents is already in the smallest unit (ZAR cents = kobo for ZAR).
    if (result.amountKobo !== tx.amountCents) {
      throw new BadRequestException(
        `Paystack amount mismatch: expected ${tx.amountCents}, got ${result.amountKobo}`,
      );
    }

    await this.updateStatusFromProvider(tx.orderId, {
      status: OrderStatus.PAID,
      note: 'Paystack payment verified',
      providerStatus: 'success',
    });

    return {
      verified: true,
      orderId: tx.orderId,
      amount: result.amountKobo,
      reference,
      currency: result.currency,
    };
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
          // Record actual Stripe Tax details — non-blocking, runs after transaction commits
          void this.taxService.recordTaxTransaction(order.id).catch(() => undefined);
          break;
        case OrderStatus.CANCELLED:
        case OrderStatus.REFUNDED:
          await this.paymentsService.markPaymentRefunded(tx, order, providerStatus);
          await this.handleEscrowRefund(tx, order, dto);
          data.paymentStatus = PaymentStatus.REFUNDED;
          // Issue refund via the correct provider (non-fatal if it fails)
          void this.issueProviderRefund(order.id, order.payments).catch(() => undefined);
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

        case OrderStatus.PAID: {
          const taxLine = order.taxAmountCents
            ? `<tr><td style="padding:4px 0">Tax (${order.taxJurisdiction ?? ''})</td><td style="padding:4px 0;text-align:right">${order.currency} ${(order.taxAmountCents / 100).toFixed(2)}</td></tr>`
            : '';
          await Promise.all([
            this.notifications.sendEmail(
              buyer.email,
              `Payment confirmed — ${ref}`,
              `<p>Hi ${buyer.name},</p><p>Your payment for order <strong>${ref}</strong> has been received. Here is your receipt summary:</p>` +
              `<table style="width:100%;border-collapse:collapse;font-size:14px">` +
              `<tr><td style="padding:4px 0">Subtotal</td><td style="padding:4px 0;text-align:right">${order.currency} ${((order.totalItemCents + order.shippingCents + order.feeCents) / 100).toFixed(2)}</td></tr>` +
              taxLine +
              `</table>` +
              `<p><a href="${orderUrl}">View your order</a></p>`,
            ),
            this.notifications.sendEmail(
              seller.email,
              `Payment received — ${ref}`,
              `<p>Hi ${seller.name},</p><p>Payment for order <strong>${ref}</strong> (${total}) has been captured and is held in escrow. Please ship the item and update tracking.</p><p><a href="${orderUrl}">View order</a></p>`,
            ),
            this.notifications.createInApp(seller.id, 'order.paid', { orderId: order.id, ref }),
            this.notifications.createInApp(buyer.id, 'order.paid', { orderId: order.id, ref }),
          ]);
          break;
        }

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

  async getReceipt(orderId: string, userId: string): Promise<TaxReceiptResult> {
    // Access check — buyer or seller only
    await this.findById(orderId, userId);
    const receipt = await this.taxService.generateTaxReceipt(orderId);
    if (!receipt) {
      throw new NotFoundException('Order not found');
    }
    return receipt;
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

  private async issueProviderRefund(
    orderId: string,
    payments: Array<{ provider: string; status: string; providerRef?: string | null }>,
  ): Promise<void> {
    const captured = payments.find(
      (p) =>
        (p.status === PaymentStatus.CAPTURED || p.status === PaymentStatus.AUTHORIZED || p.status === PaymentStatus.SETTLED) &&
        p.providerRef,
    );
    if (!captured?.providerRef) return;

    if (captured.provider === PaymentProvider.PAYSTACK) {
      await this.paystackService.refundTransaction(captured.providerRef);
    } else {
      await this.paymentsService.issueStripeRefund(orderId, 'requested_by_customer');
    }
  }

  /**
   * POST /orders/:id/label
   * Seller selects a Shippo rate (obtained from POST /shipping/rates) and purchases the label.
   * Updates OrderShipment, advances order to FULFILLED, and returns the label PDF URL.
   */
  async purchaseLabel(
    orderId: string,
    sellerId: string,
    rateId: string,
  ): Promise<{ labelUrl: string; trackingNumber: string; carrier: string; estimatedDelivery: Date | null }> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.sellerId !== sellerId) throw new ForbiddenException('Only the seller can purchase a shipping label');
    if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Order must be PAID or CONFIRMED before purchasing a label');
    }

    const label = await this.shippingService.purchaseLabel(rateId);

    // Upsert shipment record
    const existingShipment = await this.prisma.orderShipment.findFirst({ where: { orderId } });

    if (existingShipment) {
      await this.prisma.orderShipment.update({
        where: { id: existingShipment.id },
        data: {
          carrier: label.carrier,
          trackingNumber: label.trackingNumber,
          labelUrl: label.labelUrl,
          shippingRateId: rateId,
          shippoTransactionId: label.shippoTransactionId,
          estimatedDelivery: label.estimatedDelivery,
          status: 'LABEL_CREATED',
          shippedAt: new Date(),
        },
      });
    } else {
      await this.prisma.orderShipment.create({
        data: {
          orderId,
          carrier: label.carrier,
          trackingNumber: label.trackingNumber,
          labelUrl: label.labelUrl,
          shippingRateId: rateId,
          shippoTransactionId: label.shippoTransactionId,
          estimatedDelivery: label.estimatedDelivery,
          status: 'LABEL_CREATED',
          shippedAt: new Date(),
        },
      });
    }

    // Advance order status to FULFILLED (label purchased = seller intends to ship)
    const currentOrderStatus: string = order.status;
    if (currentOrderStatus !== OrderStatus.FULFILLED) {
      await this.updateStatus(orderId, {
        status: OrderStatus.FULFILLED,
        note: `Shipping label purchased — carrier: ${label.carrier}, tracking: ${label.trackingNumber}`,
        actorId: sellerId,
      });
    }

    return {
      labelUrl: label.labelUrl,
      trackingNumber: label.trackingNumber,
      carrier: label.carrier,
      estimatedDelivery: label.estimatedDelivery,
    };
  }

  /** GET /orders/:id/tracking — returns all tracking events from our DB. */
  async getTrackingEvents(orderId: string, userId: string) {
    await this.findById(orderId, userId); // access check (buyer or seller)

    const events = await this.prisma.trackingEvent.findMany({
      where: { orderId },
      orderBy: { timestamp: 'asc' },
    });

    const shipment = await this.prisma.orderShipment.findFirst({
      where: { orderId },
      select: { carrier: true, trackingNumber: true, estimatedDelivery: true, status: true, labelUrl: true },
    });

    return { shipment, events };
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
