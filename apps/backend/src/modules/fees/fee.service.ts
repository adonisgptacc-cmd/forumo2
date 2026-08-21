import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface FeeBreakdown {
  feeAmountCents: number;
  feePercent: number;
  breakdown: { percentPart: number; fixedPart: number };
}

@Injectable()
export class FeeService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeeScheduleForListing(listingId: string) {
    const assignment = await this.prisma.listingCategoryAssignment.findFirst({
      where: { listingId, isPrimary: true },
      select: { categoryId: true },
    });

    if (assignment) {
      const categorySchedule = await this.prisma.feeSchedule.findFirst({
        where: { categoryId: assignment.categoryId, isActive: true },
        orderBy: { createdAt: "desc" },
      });
      if (categorySchedule) return categorySchedule;
    }

    return this.prisma.feeSchedule.findFirst({
      where: { categoryId: null, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async calculateFee(
    subtotalCents: number,
    listingId: string,
  ): Promise<FeeBreakdown> {
    if (subtotalCents <= 0) {
      return {
        feeAmountCents: 0,
        feePercent: 0,
        breakdown: { percentPart: 0, fixedPart: 0 },
      };
    }

    const schedule = await this.getFeeScheduleForListing(listingId);
    if (!schedule) {
      return {
        feeAmountCents: 0,
        feePercent: 0,
        breakdown: { percentPart: 0, fixedPart: 0 },
      };
    }

    const feePercent = Number(schedule.feePercent);
    const percentPart = Math.round((subtotalCents * feePercent) / 100);
    const fixedPart = schedule.fixedFeeCents;
    let feeAmount = Math.max(percentPart + fixedPart, schedule.minFeeCents);
    if (schedule.maxFeeCents !== null && schedule.maxFeeCents !== undefined) {
      feeAmount = Math.min(feeAmount, schedule.maxFeeCents);
    }

    return {
      feeAmountCents: feeAmount,
      feePercent,
      breakdown: { percentPart, fixedPart },
    };
  }

  async applyFeeToOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { take: 1, select: { listingId: true } } },
    });
    if (!order) throw new NotFoundException("Order not found");

    const primaryListingId = order.items[0]?.listingId;
    if (!primaryListingId) return;

    const { feeAmountCents, feePercent } = await this.calculateFee(
      order.totalItemCents,
      primaryListingId,
    );
    await this.prisma.order.update({
      where: { id: orderId },
      data: { feeCents: feeAmountCents, feePercent },
    });
  }

  async listSchedules() {
    return this.prisma.feeSchedule.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async createSchedule(data: {
    name: string;
    categoryId?: string | null;
    feePercent: number;
    fixedFeeCents?: number;
    minFeeCents?: number;
    maxFeeCents?: number | null;
    createdBy: string;
  }) {
    return this.prisma.feeSchedule.create({
      data: {
        name: data.name,
        categoryId: data.categoryId ?? null,
        feePercent: data.feePercent,
        fixedFeeCents: data.fixedFeeCents ?? 0,
        minFeeCents: data.minFeeCents ?? 0,
        maxFeeCents: data.maxFeeCents ?? null,
        createdBy: data.createdBy,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async updateSchedule(
    id: string,
    data: Partial<{
      name: string;
      categoryId: string | null;
      feePercent: number;
      fixedFeeCents: number;
      minFeeCents: number;
      maxFeeCents: number | null;
      isActive: boolean;
    }>,
  ) {
    return this.prisma.feeSchedule.update({
      where: { id },
      data,
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async softDeleteSchedule(id: string) {
    return this.prisma.feeSchedule.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
