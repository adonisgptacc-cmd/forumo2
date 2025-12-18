import { Injectable } from '@nestjs/common';

import { PrismaService } from "../../prisma/prisma.service";
import { AdminDisputeSummary, AdminKycSubmission, AdminListingModeration } from '@forumo/shared';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
        metadata: doc.metadata as any,
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
}
