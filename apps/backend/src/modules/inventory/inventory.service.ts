import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { CacheService } from "../../common/services/cache.service";

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getInventoryByVariant(variantId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { variantId },
      include: {
        variant: {
          include: {
            listing: {
              select: {
                id: true,
                title: true,
                sellerId: true,
              },
            },
          },
        },
      },
    });

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const availableQuantity = items.reduce(
      (sum, item) => sum + item.availableQuantity,
      0,
    );
    const reservedQuantity = items.reduce(
      (sum, item) => sum + item.reservedQuantity,
      0,
    );
    const damagedQuantity = items.reduce(
      (sum, item) => sum + item.damagedQuantity,
      0,
    );

    return {
      variantId,
      items,
      summary: {
        totalQuantity,
        availableQuantity,
        reservedQuantity,
        damagedQuantity,
      },
    };
  }

  async addStock(
    variantId: string,
    quantity: number,
    location?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: External SDK or dynamic payload requires flexible typing, TODO: refine to specific type
    metadata?: any,
  ) {
    // Check if variant exists
    const variant = await this.prisma.listingVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException("Variant not found");
    }

    // Create or update inventory item
    const item = await this.prisma.inventoryItem.create({
      data: {
        variantId,
        quantity,
        availableQuantity: quantity,
        reservedQuantity: 0,
        damagedQuantity: 0,
        location: location || "default",
        metadata: metadata || {},
      },
    });

    // Update variant inventory count
    await this.updateVariantInventoryCount(variantId);

    return item;
  }

  async reserveStock(variantId: string, quantity: number, orderId: string) {
    // Find available inventory items
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        variantId,
        availableQuantity: { gte: quantity },
      },
      orderBy: {
        createdAt: "asc", // FIFO
      },
      take: 1,
    });

    if (items.length === 0 || items[0].availableQuantity < quantity) {
      throw new BadRequestException("Insufficient stock available");
    }

    const item = items[0];

    // Create reservation
    const reservation = await this.prisma.inventoryReservation.create({
      data: {
        variantId,
        orderId,
        quantity,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
    });

    // Update inventory item
    await this.prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        availableQuantity: { decrement: quantity },
        reservedQuantity: { increment: quantity },
      },
    });

    // Update variant inventory count
    await this.updateVariantInventoryCount(variantId);

    return reservation;
  }

  async confirmReservation(reservationId: string) {
    const reservation = await this.prisma.inventoryReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    if (reservation.status !== "PENDING") {
      throw new BadRequestException("Reservation already processed");
    }

    // Update reservation status
    const updated = await this.prisma.inventoryReservation.update({
      where: { id: reservationId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });

    // Deduct from reserved quantity
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        variantId: reservation.variantId,
        reservedQuantity: { gte: reservation.quantity },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 1,
    });

    if (items.length > 0) {
      await this.prisma.inventoryItem.update({
        where: { id: items[0].id },
        data: {
          reservedQuantity: { decrement: reservation.quantity },
          quantity: { decrement: reservation.quantity },
        },
      });
    }

    // Update variant inventory count
    await this.updateVariantInventoryCount(reservation.variantId);

    return updated;
  }

  async releaseReservation(reservationId: string) {
    const reservation = await this.prisma.inventoryReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    if (reservation.status !== "PENDING") {
      throw new BadRequestException("Reservation already processed");
    }

    // Update reservation status
    const updated = await this.prisma.inventoryReservation.update({
      where: { id: reservationId },
      data: {
        status: "RELEASED",
        releasedAt: new Date(),
      },
    });

    // Return stock to available
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        variantId: reservation.variantId,
        reservedQuantity: { gte: reservation.quantity },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 1,
    });

    if (items.length > 0) {
      await this.prisma.inventoryItem.update({
        where: { id: items[0].id },
        data: {
          reservedQuantity: { decrement: reservation.quantity },
          availableQuantity: { increment: reservation.quantity },
        },
      });
    }

    // Update variant inventory count
    await this.updateVariantInventoryCount(reservation.variantId);

    return updated;
  }

  async markDamaged(itemId: string, quantity: number, reason?: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException("Inventory item not found");
    }

    if (item.availableQuantity < quantity) {
      throw new BadRequestException(
        "Insufficient available stock to mark as damaged",
      );
    }

    // Update inventory item
    const updated = await this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        availableQuantity: { decrement: quantity },
        damagedQuantity: { increment: quantity },
        metadata: {
          ...((item.metadata as Record<string, unknown>) || {}),
          damageReports: [
            ...(((item.metadata as Record<string, unknown>)
              ?.damageReports as unknown[]) || []),
            {
              quantity,
              reason,
              reportedAt: new Date().toISOString(),
            },
          ],
        } as Prisma.InputJsonValue,
      },
    });

    // Update variant inventory count
    await this.updateVariantInventoryCount(item.variantId);

    return updated;
  }

  async adjustStock(variantId: string, adjustment: number, reason: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { variantId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    if (items.length === 0) {
      // Create new inventory item
      return this.addStock(variantId, adjustment, "default", { reason });
    }

    const item = items[0];

    // Update inventory item
    const updated = await this.prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        quantity: { increment: adjustment },
        availableQuantity: { increment: adjustment },
        metadata: {
          ...((item.metadata as Record<string, unknown>) || {}),
          adjustments: [
            ...(((item.metadata as Record<string, unknown>)
              ?.adjustments as unknown[]) || []),
            {
              adjustment,
              reason,
              adjustedAt: new Date().toISOString(),
            },
          ],
        } as Prisma.InputJsonValue,
      },
    });

    // Update variant inventory count
    await this.updateVariantInventoryCount(variantId);

    return updated;
  }

  private async updateVariantInventoryCount(variantId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { variantId },
    });

    const totalAvailable = items.reduce(
      (sum, item) => sum + item.availableQuantity,
      0,
    );

    await this.prisma.listingVariant.update({
      where: { id: variantId },
      data: {
        inventoryCount: totalAvailable,
      },
    });
    await this.cache.deleteByPrefix("listings:search:");
  }

  async getReservationsByOrder(orderId: string) {
    return this.prisma.inventoryReservation.findMany({
      where: { orderId },
      include: {
        variant: {
          include: {
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });
  }

  async cleanupExpiredReservations() {
    const expired = await this.prisma.inventoryReservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: new Date() },
      },
    });

    for (const reservation of expired) {
      await this.releaseReservation(reservation.id);
    }

    return { released: expired.length };
  }
}
