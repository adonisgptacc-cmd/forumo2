import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from "../../prisma/prisma.service";
import { AdminDisputeSummary, AdminKycSubmission, AdminListingModeration, AdminUserDetail, AdminOrderSummary } from '@forumo/shared';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
    }));
  }

  async listUsers(): Promise<AdminUserDetail[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
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
