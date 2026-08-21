import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export type Period = "7d" | "30d" | "90d";
export type GroupBy = "day" | "week" | "month";

function periodToDays(period: Period): number {
  return period === "7d" ? 7 : period === "30d" ? 30 : 90;
}

function periodStart(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pctChange(current: number, prior: number): number {
  if (prior === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prior) / prior) * 100);
}

function dateKey(date: Date, groupBy: GroupBy): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (groupBy === "day") return `${y}-${m}-${d}`;
  if (groupBy === "month") return `${y}-${m}`;
  // week: ISO week starting Monday
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  const wy = monday.getFullYear();
  const wm = String(monday.getMonth() + 1).padStart(2, "0");
  const wd = String(monday.getDate()).padStart(2, "0");
  return `${wy}-${wm}-${wd}`;
}

const COUNTED_STATUSES = [
  "COMPLETED",
  "DELIVERED",
  "PAID",
  "FULFILLED",
] as const;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(sellerId: string, period: Period) {
    const days = periodToDays(period);
    const now = new Date();
    const currentStart = periodStart(days);
    const priorStart = periodStart(days * 2);

    const [currentOrders, priorOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          sellerId,
          status: { in: [...COUNTED_STATUSES] },
          placedAt: { gte: currentStart, lte: now },
        },
        select: { totalItemCents: true },
      }),
      this.prisma.order.findMany({
        where: {
          sellerId,
          status: { in: [...COUNTED_STATUSES] },
          placedAt: { gte: priorStart, lt: currentStart },
        },
        select: { totalItemCents: true },
      }),
    ]);

    const gmv = currentOrders.reduce((s, o) => s + o.totalItemCents, 0);
    const orders = currentOrders.length;
    const avgOrderValue = orders > 0 ? Math.round(gmv / orders) : 0;

    const priorGmv = priorOrders.reduce((s, o) => s + o.totalItemCents, 0);
    const priorOrdersCount = priorOrders.length;
    const priorAov =
      priorOrdersCount > 0 ? Math.round(priorGmv / priorOrdersCount) : 0;

    return {
      gmv,
      orders,
      avgOrderValue,
      conversionRate: 0,
      pageViews: 0,
      uniqueVisitors: 0,
      changes: {
        gmvChange: pctChange(gmv, priorGmv),
        ordersChange: pctChange(orders, priorOrdersCount),
        aovChange: pctChange(avgOrderValue, priorAov),
      },
    };
  }

  async getRevenue(sellerId: string, period: Period, groupBy: GroupBy) {
    const days = periodToDays(period);
    const start = periodStart(days);

    const orders = await this.prisma.order.findMany({
      where: {
        sellerId,
        status: { in: [...COUNTED_STATUSES] },
        placedAt: { gte: start },
      },
      select: { totalItemCents: true, feeCents: true, placedAt: true },
      orderBy: { placedAt: "asc" },
    });

    const buckets = new Map<
      string,
      { revenue: number; orders: number; fees: number }
    >();
    for (const o of orders) {
      if (!o.placedAt) continue;
      const key = dateKey(o.placedAt, groupBy);
      const existing = buckets.get(key) ?? { revenue: 0, orders: 0, fees: 0 };
      existing.revenue += o.totalItemCents;
      existing.orders += 1;
      existing.fees += o.feeCents;
      buckets.set(key, existing);
    }

    return Array.from(buckets.entries()).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      orders: data.orders,
      fees: data.fees,
    }));
  }

  async getTopListings(sellerId: string, limit: number) {
    const orderItems = await this.prisma.orderItem.findMany({
      where: { order: { sellerId, status: { in: [...COUNTED_STATUSES] } } },
      select: { listingId: true, unitPriceCents: true, quantity: true },
    });

    // aggregate in code since there's no subtotalCents column
    const byListing = new Map<string, { revenue: number; orders: number }>();
    for (const item of orderItems) {
      const existing = byListing.get(item.listingId) ?? {
        revenue: 0,
        orders: 0,
      };
      existing.revenue += item.unitPriceCents * item.quantity;
      existing.orders += 1;
      byListing.set(item.listingId, existing);
    }

    const sorted = [...byListing.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, limit);

    const listingIds = sorted.map(([id]) => id);
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: listingIds } },
      select: {
        id: true,
        title: true,
        images: {
          select: { url: true },
          take: 1,
          orderBy: { position: "asc" },
        },
      },
    });

    const listingMap = new Map(listings.map((l) => [l.id, l]));

    return sorted.map(([listingId, data]) => {
      const listing = listingMap.get(listingId);
      return {
        listingId,
        title: listing?.title ?? "Unknown",
        thumbnailUrl: listing?.images?.[0]?.url ?? null,
        views: 0,
        orders: data.orders,
        revenue: data.revenue,
        conversionRate: 0,
      };
    });
  }

  async getReviewsSummary(sellerId: string) {
    const rollup = await this.prisma.sellerReviewRollup.findUnique({
      where: { sellerId },
    });

    if (!rollup) {
      return {
        avgRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    return {
      avgRating: Number(rollup.averageRating),
      totalReviews: rollup.publishedCount,
      ratingDistribution: {
        1: rollup.star1,
        2: rollup.star2,
        3: rollup.star3,
        4: rollup.star4,
        5: rollup.star5,
      },
    };
  }
}
