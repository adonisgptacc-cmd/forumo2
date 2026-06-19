import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, AccountStatus, UserRole } from '@prisma/client';

import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AdminDisputeSummary, AdminKycSubmission, AdminListingModeration, AdminUserDetail, AdminOrderSummary } from '@forumo/shared';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Account Status Management ───────────────────────────────────────────────

  async suspendUser(
    userId: string,
    reason: string,
    durationDays?: number | null,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const suspendedUntil =
      durationDays != null ? new Date(Date.now() + durationDays * 86_400_000) : null;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          accountStatus: 'SUSPENDED',
          suspensionReason: reason,
          suspendedUntil,
          tokenVersion: { increment: 1 },
        },
      }),
      // Cancel all published listings; use SUSPENDED status so they can be identified later
      this.prisma.listing.updateMany({
        where: { sellerId: userId, status: 'PUBLISHED', deletedAt: null },
        data: { status: 'SUSPENDED' },
      }),
    ]);

    await this.notifications.notifyAccountSuspended(user.email, user.name, reason, suspendedUntil);
  }

  async unsuspendUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: 'ACTIVE',
        suspensionReason: null,
        suspendedUntil: null,
      },
    });

    await this.notifications.notifyAccountUnsuspended(user.email, user.name);
  }

  async banUser(userId: string, reason: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          accountStatus: 'BANNED',
          banReason: reason,
          suspensionReason: null,
          suspendedUntil: null,
          tokenVersion: { increment: 1 },
        },
      }),
      // Cancel all published listings
      this.prisma.listing.updateMany({
        where: { sellerId: userId, status: 'PUBLISHED', deletedAt: null },
        data: { status: 'SUSPENDED' },
      }),
      // Cancel open orders where the banned user is the buyer or seller
      this.prisma.order.updateMany({
        where: {
          status: { in: ['PENDING', 'CONFIRMED'] },
          OR: [{ buyerId: userId }, { sellerId: userId }],
        },
        data: { status: 'CANCELLED' },
      }),
    ]);

    await this.notifications.notifyAccountBanned(user.email, user.name, reason);
  }

  // ─── Cron: auto-lift expired temporary suspensions ───────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async liftExpiredSuspensions(): Promise<void> {
    const expired = await this.prisma.user.findMany({
      where: {
        accountStatus: 'SUSPENDED',
        suspendedUntil: { lte: new Date() },
        deletedAt: null,
      },
      select: { id: true, email: true, name: true },
    });

    if (expired.length === 0) return;

    await this.prisma.user.updateMany({
      where: { id: { in: expired.map((u) => u.id) } },
      data: { accountStatus: 'ACTIVE', suspensionReason: null, suspendedUntil: null },
    });

    await Promise.all(
      expired.map((u) => this.notifications.notifyAccountUnsuspended(u.email, u.name)),
    );
  }

  async getDashboardStats() {
    const [userCount, listingCount, orderCount, disputeCount, pendingKyc, pendingModeration] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.listing.count({ where: { deletedAt: null } }),
      this.prisma.order.count(),
      this.prisma.escrowDispute.count({ where: { status: 'OPEN' } }),
      this.prisma.kycSubmission.count({ where: { status: 'PENDING' } }),
      this.prisma.listing.count({ where: { moderationStatus: 'PENDING', deletedAt: null } }),
    ]);

    return {
      totalUsers: userCount,
      activeListings: listingCount,
      totalOrders: orderCount,
      openDisputes: disputeCount,
      pendingKyc,
      pendingModeration,
    };
  }

  async listKycSubmissions(): Promise<AdminKycSubmission[]> {
    const submissions = await this.prisma.kycSubmission.findMany({
      orderBy: { submittedAt: 'asc' },
      include: {
        documents: true,
        user: { select: { id: true, email: true, name: true } },
        reviewer: { select: { id: true, email: true, name: true } },
      },
      take: 100,
    });

    return submissions.map((submission) => ({
      id: submission.id,
      userId: submission.userId,
      reviewerId: submission.reviewerId ?? undefined,
      status: submission.status,
      rejectionReason: submission.rejectionReason ?? null,
      submittedAt: submission.submittedAt.toISOString(),
      reviewedAt: submission.reviewedAt?.toISOString() ?? null,
      documents: submission.documents.map((doc) => ({
        id: doc.id,
        submissionId: doc.submissionId,
        type: doc.type,
        status: doc.status,
        url: doc.url ?? null,
        createdAt: doc.createdAt.toISOString(),
        metadata: doc.metadata as Record<string, unknown>,
      })),
      user: submission.user
        ? { id: submission.user.id, email: submission.user.email, name: submission.user.name }
        : undefined,
      reviewer: submission.reviewer
        ? { id: submission.reviewer.id, email: submission.reviewer.email, name: submission.reviewer.name }
        : null,
    }));
  }

  async listListingsForReview(): Promise<AdminListingModeration[]> {
    const listings = await this.prisma.listing.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        seller: { select: { id: true, email: true, name: true } },
      },
    });

    return listings.map((listing) => ({
      id: listing.id,
      sellerId: listing.sellerId,
      title: listing.title,
      status: listing.status,
      moderationStatus: listing.moderationStatus,
      moderationNotes: listing.moderationNotes ?? null,
      createdAt: listing.createdAt.toISOString(),
      updatedAt: listing.updatedAt.toISOString(),
      seller: listing.seller
        ? { id: listing.seller.id, email: listing.seller.email, name: listing.seller.name }
        : undefined,
    }));
  }

  async listUsers(
    params: { search?: string; status?: string; role?: string; page?: number; limit?: number } = {},
  ): Promise<AdminUserDetail[]> {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(params.limit ?? 50)));

    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (params.status && (Object.values(AccountStatus) as string[]).includes(params.status)) {
      where.accountStatus = params.status as AccountStatus;
    }
    if (params.role && (Object.values(UserRole) as string[]).includes(params.role)) {
      where.role = params.role as UserRole;
    }
    if (params.search?.trim()) {
      const term = params.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accountStatus: true,
        kycStatus: true,
        createdAt: true,
        _count: { select: { listings: true } },
      },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      accountStatus: u.accountStatus,
      kycStatus: u.kycStatus,
      listingsCount: u._count.listings,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async listOrders(): Promise<AdminOrderSummary[]> {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        orderNumber: true,
        totalItemCents: true,
        currency: true,
        status: true,
        paymentStatus: true,
        placedAt: true,
        buyer: { select: { name: true, email: true } },
      },
    });

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      buyerName: o.buyer.name ?? null,
      buyerEmail: o.buyer.email ?? null,
      totalItemCents: o.totalItemCents,
      currency: o.currency,
      status: o.status,
      paymentStatus: o.paymentStatus,
      placedAt: o.placedAt?.toISOString() ?? null,
    }));
  }

  async listDisputes(): Promise<AdminDisputeSummary[]> {
    const disputes = await this.prisma.escrowDispute.findMany({
      orderBy: { openedAt: 'desc' },
      include: {
        messages: true,
        openedBy: { select: { id: true, email: true, name: true } },
        escrow: {
          include: {
            order: { select: { id: true, orderNumber: true, totalItemCents: true, currency: true } },
          },
        },
      },
      take: 100,
    });

    return disputes.map((dispute) => ({
      id: dispute.id,
      escrowId: dispute.escrowId,
      orderId: dispute.escrow.order?.id,
      orderNumber: dispute.escrow.order?.orderNumber,
      status: dispute.status,
      reason: dispute.reason,
      resolution: dispute.resolution ?? null,
      openedBy: dispute.openedBy
        ? { id: dispute.openedBy.id, email: dispute.openedBy.email, name: dispute.openedBy.name }
        : undefined,
      openedAt: dispute.openedAt.toISOString(),
      resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
      amountCents: dispute.escrow.order?.totalItemCents,
      currency: dispute.escrow.order?.currency,
      messageCount: dispute.messages.length,
    }));
  }

  async getAnalytics() {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Daily revenue (last 7 days) — sum of totalItemCents per day
    const dailyOrders = await this.prisma.order.findMany({
      where: { createdAt: { gte: sevenDaysAgo }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      select: { createdAt: true, totalItemCents: true },
    });

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyRevenue: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyRevenue[key] = 0;
    }
    for (const order of dailyOrders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      if (key in dailyRevenue) dailyRevenue[key] += order.totalItemCents;
    }
    const salesTrend = Object.entries(dailyRevenue).map(([date, value]) => ({
      label: dayLabels[new Date(date).getDay()],
      value,
    }));

    // Monthly user registrations (last 6 months)
    const monthlyUsers = await this.prisma.user.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    });

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyCount: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyCount[key] = 0;
    }
    for (const user of monthlyUsers) {
      const key = `${user.createdAt.getFullYear()}-${String(user.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthlyCount) monthlyCount[key]++;
    }
    const userGrowth = Object.entries(monthlyCount).map(([key, value]) => ({
      label: monthLabels[parseInt(key.split('-')[1], 10) - 1],
      value,
    }));

    // Recent activity (last 10 orders + KYC reviews + disputes)
    const [recentOrders, recentKyc, recentDisputes] = await Promise.all([
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { orderNumber: true, createdAt: true, status: true, totalItemCents: true, currency: true },
      }),
      this.prisma.kycSubmission.findMany({
        where: { reviewedAt: { not: null } },
        orderBy: { reviewedAt: 'desc' },
        take: 3,
        select: { status: true, reviewedAt: true, user: { select: { name: true, email: true } } },
      }),
      this.prisma.escrowDispute.findMany({
        orderBy: { openedAt: 'desc' },
        take: 3,
        select: { reason: true, openedAt: true, status: true, escrow: { select: { order: { select: { orderNumber: true } } } } },
      }),
    ]);

    const recentActivity = [
      ...recentOrders.map((o) => ({
        title: `Order #${o.orderNumber}`,
        meta: `${o.status} · ${(o.totalItemCents / 100).toFixed(2)} ${o.currency}`,
        time: o.createdAt.toISOString(),
        tone: o.status === 'COMPLETED' ? 'emerald' : o.status === 'DISPUTED' ? 'rose' : 'amber',
      })),
      ...recentKyc.map((k) => ({
        title: `KYC ${k.status.toLowerCase()}`,
        meta: k.user?.name ?? k.user?.email ?? 'Unknown user',
        time: (k.reviewedAt ?? new Date()).toISOString(),
        tone: k.status === 'APPROVED' ? 'emerald' : 'rose',
      })),
      ...recentDisputes.map((d) => ({
        title: `Dispute ${d.status.toLowerCase()}`,
        meta: `Order #${d.escrow?.order?.orderNumber ?? '—'}: ${d.reason.slice(0, 60)}`,
        time: d.openedAt.toISOString(),
        tone: 'rose',
      })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8)
      .map((item) => ({
        ...item,
        time: this.formatRelativeTime(new Date(item.time)),
      }));

    return { salesTrend, userGrowth, recentActivity };
  }

  private formatRelativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  }

  async reviewKycSubmission(
    id: string,
    body: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string | null },
  ): Promise<AdminKycSubmission> {
    const existing = await this.prisma.kycSubmission.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('KYC submission not found');

    const updated = await this.prisma.kycSubmission.update({
      where: { id },
      data: {
        status: body.status,
        rejectionReason: body.rejectionReason ?? null,
        reviewedAt: new Date(),
      },
      include: {
        documents: true,
        user: { select: { id: true, email: true, name: true } },
        reviewer: { select: { id: true, email: true, name: true } },
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      reviewerId: updated.reviewerId ?? undefined,
      status: updated.status,
      rejectionReason: updated.rejectionReason ?? null,
      submittedAt: updated.submittedAt.toISOString(),
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      documents: updated.documents.map((doc) => ({
        id: doc.id,
        submissionId: doc.submissionId,
        type: doc.type,
        status: doc.status,
        url: doc.url ?? null,
        createdAt: doc.createdAt.toISOString(),
        metadata: doc.metadata as Record<string, unknown>,
      })),
      user: updated.user
        ? { id: updated.user.id, email: updated.user.email, name: updated.user.name }
        : undefined,
      reviewer: updated.reviewer
        ? { id: updated.reviewer.id, email: updated.reviewer.email, name: updated.reviewer.name }
        : null,
    };
  }

  async reviewListing(
    id: string,
    body: { moderationStatus: string; moderationNotes?: string | null },
  ): Promise<AdminListingModeration> {
    const existing = await this.prisma.listing.findUnique({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Listing not found');

    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        moderationStatus: body.moderationStatus as any,
        moderationNotes: body.moderationNotes ?? null,
      },
    });

    return {
      id: updated.id,
      sellerId: updated.sellerId,
      title: updated.title,
      status: updated.status,
      moderationStatus: updated.moderationStatus,
      moderationNotes: updated.moderationNotes ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async resolveDispute(
    id: string,
    body: { status: string; resolution?: string | null },
  ): Promise<AdminDisputeSummary> {
    const existing = await this.prisma.escrowDispute.findUnique({
      where: { id },
      include: {
        messages: true,
        openedBy: { select: { id: true, email: true, name: true } },
        escrow: {
          include: {
            order: { select: { id: true, orderNumber: true, totalItemCents: true, currency: true } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Dispute not found');

    const updated = await this.prisma.escrowDispute.update({
      where: { id },
      data: {
        status: body.status as any,
        resolution: body.resolution ?? null,
        resolvedAt: body.status === 'RESOLVED' ? new Date() : undefined,
      },
      include: {
        messages: true,
        openedBy: { select: { id: true, email: true, name: true } },
        escrow: {
          include: {
            order: { select: { id: true, orderNumber: true, totalItemCents: true, currency: true } },
          },
        },
      },
    });

    return {
      id: updated.id,
      escrowId: updated.escrowId,
      orderId: updated.escrow.order?.id,
      orderNumber: updated.escrow.order?.orderNumber,
      status: updated.status,
      reason: updated.reason,
      resolution: updated.resolution ?? null,
      openedBy: updated.openedBy
        ? { id: updated.openedBy.id, email: updated.openedBy.email, name: updated.openedBy.name }
        : undefined,
      openedAt: updated.openedAt.toISOString(),
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      amountCents: updated.escrow.order?.totalItemCents,
      currency: updated.escrow.order?.currency,
      messageCount: updated.messages.length,
    };
  }
}
