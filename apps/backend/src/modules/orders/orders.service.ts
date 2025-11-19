import { randomUUID } from 'crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { SafeOrder, serializeOrder } from './order.serializer.js';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<SafeOrder[]> {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude,
    });
    return orders.map((order) => serializeOrder(order));
  }

  async findById(id: string): Promise<SafeOrder> {
    const order = await this.prisma.order.findFirst({
      where: { id },
      include: this.defaultInclude,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return serializeOrder(order);
  }

  async create(dto: CreateOrderDto): Promise<SafeOrder> {
    await Promise.all([this.ensureUserExists(dto.buyerId), this.ensureUserExists(dto.sellerId)]);

    const lineItems = await this.buildOrderItems(dto);
    const totalItemCents = lineItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const currency = dto.currency ?? lineItems[0]?.currency ?? 'USD';

    const order = await this.prisma.order.create({
      data: {
        orderNumber: this.generateOrderNumber(),
        buyerId: dto.buyerId,
        sellerId: dto.sellerId,
        totalItemCents,
        shippingCents: dto.shippingCents ?? 0,
        feeCents: dto.feeCents ?? 0,
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
      include: this.defaultInclude,
    });

    return serializeOrder(order);
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<SafeOrder> {
    await this.ensureOrderExists(id);
    const timestamps = this.getStatusTimestamps(dto.status);

    const order = await this.prisma.order.update({
      where: { id },
      data: {
        status: dto.status,
        ...timestamps,
        timeline: {
          create: [
            {
              status: dto.status,
              note: dto.note ?? null,
              actorId: dto.actorId ?? null,
            },
          ],
        },
      },
      include: this.defaultInclude,
    });

    return serializeOrder(order);
  }

  private async buildOrderItems(dto: CreateOrderDto) {
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
      } satisfies Prisma.OrderItemCreateWithoutOrderInput;
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

  private async ensureOrderExists(id: string): Promise<void> {
    const order = await this.prisma.order.findFirst({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
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
      default:
        return {};
    }
  }

  private toJsonInput(value?: Record<string, unknown> | null): Prisma.InputJsonValue | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }

  private generateOrderNumber(): string {
    return `ORD-${randomUUID().split('-')[0].toUpperCase()}`;
  }

  private get defaultInclude() {
    return {
      items: { orderBy: { createdAt: 'asc' } },
      shipments: true,
      timeline: { orderBy: { createdAt: 'asc' } },
    } satisfies Prisma.OrderInclude;
  }
}
