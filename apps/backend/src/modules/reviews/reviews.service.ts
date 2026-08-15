import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, ReviewStatus, UserRole } from '@prisma/client';

import { PrismaService } from "../../prisma/prisma.service";
import { sanitizeText } from "../../common/utils/sanitize";
import { CreateReviewDto, UpdateReviewDto } from "./dto/create-review.dto";
import { ReviewModerationService } from "./moderation.service";
import { ListingReviewResponse, ReviewRollup, SafeReview, serializeReview, serializeRollup } from "./review.serializer";

export interface ReviewActor {
  id: string;
  role: string;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService, private readonly moderation: ReviewModerationService) { }

  private isPrivileged(actor: ReviewActor): boolean {
    return actor.role === UserRole.ADMIN || actor.role === UserRole.MODERATOR;
  }

  async listForListing(listingId: string, viewerId?: string): Promise<ListingReviewResponse> {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, deletedAt: null } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const [reviews, rollupRecord] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { listingId, status: ReviewStatus.PUBLISHED },
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: { select: { id: true, name: true, avatarUrl: true, trustScore: true, createdAt: true } },
          flags: true,
          votes: true,
        },
      }),
      this.prisma.sellerReviewRollup.findUnique({ where: { sellerId: listing.sellerId } }),
    ]);

    return {
      reviews: reviews.map((review) => serializeReview(review, viewerId)),
      rollup: serializeRollup(rollupRecord, listing.sellerId),
    };
  }

  async voteReview(reviewId: string, userId: string): Promise<{ helpfulCount: number; userVoted: boolean }> {
    const review = await this.prisma.review.findFirst({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');

    await this.prisma.reviewVote.upsert({
      where: { reviewId_userId: { reviewId, userId } },
      create: { reviewId, userId, isHelpful: true },
      update: { isHelpful: true },
    });

    const helpfulCount = await this.prisma.reviewVote.count({ where: { reviewId, isHelpful: true } });
    return { helpfulCount, userVoted: true };
  }

  async flagReview(reviewId: string, reason: string, userId?: string): Promise<void> {
    const review = await this.prisma.review.findFirst({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.reviewFlag.create({ data: { reviewId, reason, flaggedById: userId } });
  }

  async getRollup(sellerId: string): Promise<ReviewRollup> {
    const rollup = await this.prisma.sellerReviewRollup.findUnique({ where: { sellerId } });
    return serializeRollup(rollup, sellerId);
  }

  async findById(id: string): Promise<SafeReview> {
    const review = await this.prisma.review.findFirst({
      where: { id },
      include: {
        reviewer: { select: { id: true, name: true, avatarUrl: true, trustScore: true, createdAt: true } },
        flags: true,
        votes: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return serializeReview(review);
  }

  async create(dto: CreateReviewDto, reviewerId: string): Promise<SafeReview> {
    await this.ensureListing(dto.listingId, dto.recipientId);
    await this.checkPurchaseEligibility(reviewerId, dto.listingId, dto.orderId);

    const moderation = this.moderation.evaluate(dto.comment ?? '', dto.rating);

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          reviewerId,
          recipientId: dto.recipientId,
          listingId: dto.listingId,
          orderId: dto.orderId,
          rating: dto.rating,
          comment: dto.comment != null ? sanitizeText(dto.comment) : dto.comment,
          status: moderation.status,
          moderationNotes: moderation.notes,
          metadata: this.buildMetadata(dto.metadata),
          verifiedPurchase: true,
        },
        include: { reviewer: { select: { id: true, name: true, avatarUrl: true, trustScore: true, createdAt: true } } },
      });

      if (moderation.flags.length > 0) {
        await tx.reviewFlag.createMany({
          data: moderation.flags.map((flag) => ({
            reviewId: created.id,
            reason: flag.reason,
            notes: flag.notes,
          })),
        });
      }

      await this.refreshRollups(tx, created.recipientId);

      return created;
    });

    const createdWithFlags = await this.prisma.review.findUnique({
      where: { id: review.id },
      include: {
        reviewer: { select: { id: true, name: true, avatarUrl: true, trustScore: true, createdAt: true } },
        flags: true,
        votes: true,
      },
    });

    return serializeReview(createdWithFlags!);
  }

  async update(id: string, dto: UpdateReviewDto, actor: ReviewActor): Promise<SafeReview> {
    const existing = await this.prisma.review.findFirst({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Review not found');
    }

    const privileged = this.isPrivileged(actor);
    if (existing.reviewerId !== actor.id && !privileged) {
      throw new ForbiddenException({ code: 'NOT_REVIEW_AUTHOR', message: 'You can only edit your own review' });
    }

    const moderation = this.moderation.evaluate(dto.comment ?? existing.comment ?? '', dto.rating ?? existing.rating);
    // Only moderators/admins may set status directly; author edits are re-moderated.
    const status = privileged ? (dto.status ?? moderation.status ?? existing.status) : (moderation.status ?? existing.status);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.reviewFlag.deleteMany({ where: { reviewId: id } });

      const review = await tx.review.update({
        where: { id },
        data: {
          rating: dto.rating ?? existing.rating,
          comment: dto.comment != null ? sanitizeText(dto.comment) : existing.comment,
          status,
          moderationNotes: moderation.notes ?? existing.moderationNotes,
          metadata: (this.buildMetadata(dto.metadata) ?? existing.metadata) as Prisma.InputJsonValue,
        },
        include: { reviewer: { select: { id: true, name: true, avatarUrl: true, trustScore: true, createdAt: true } } },
      });

      if (moderation.flags.length > 0) {
        await tx.reviewFlag.createMany({
          data: moderation.flags.map((flag) => ({
            reviewId: review.id,
            reason: flag.reason,
            notes: flag.notes,
          })),
        });
      }

      await this.refreshRollups(tx, review.recipientId);

      return review;
    });

    const reloaded = await this.prisma.review.findUnique({
      where: { id: updated.id },
      include: {
        reviewer: { select: { id: true, name: true, avatarUrl: true, trustScore: true, createdAt: true } },
        flags: true,
        votes: true,
      },
    });

    return serializeReview(reloaded!);
  }

  async remove(id: string, actor: ReviewActor): Promise<void> {
    const existing = await this.prisma.review.findFirst({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Review not found');
    }

    if (existing.reviewerId !== actor.id && !this.isPrivileged(actor)) {
      throw new ForbiddenException({ code: 'NOT_REVIEW_AUTHOR', message: 'You can only delete your own review' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reviewFlag.deleteMany({ where: { reviewId: id } });
      await tx.review.delete({ where: { id } });
      await this.refreshRollups(tx, existing.recipientId);
    });
  }

  private async ensureListing(listingId: string, sellerId: string): Promise<void> {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, deletedAt: null } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== sellerId) {
      throw new BadRequestException('Recipient must match listing seller');
    }
  }

  private async checkPurchaseEligibility(reviewerId: string, listingId: string, orderId: string): Promise<void> {
    const existing = await this.prisma.review.findFirst({ where: { reviewerId, listingId } });
    if (existing) {
      throw new ForbiddenException({ code: 'ALREADY_REVIEWED', message: 'You have already reviewed this listing' });
    }

    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        buyerId: reviewerId,
        status: OrderStatus.DELIVERED,
        updatedAt: { gte: cutoff },
        items: { some: { listingId } },
      },
    });

    if (!order) {
      throw new ForbiddenException({ code: 'PURCHASE_REQUIRED', message: 'You can only review items you have purchased' });
    }
  }

  private async refreshRollups(prisma: Prisma.TransactionClient, sellerId: string): Promise<void> {
    const [published, pendingCount, flaggedCount, totalCount, starCounts] = await Promise.all([
      prisma.review.aggregate({
        where: { recipientId: sellerId, status: ReviewStatus.PUBLISHED },
        _avg: { rating: true },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.review.count({ where: { recipientId: sellerId, status: ReviewStatus.PENDING } }),
      prisma.reviewFlag.count({ where: { review: { recipientId: sellerId } } }),
      prisma.review.count({ where: { recipientId: sellerId } }),
      prisma.review.groupBy({
        by: ['rating'],
        where: { recipientId: sellerId, status: ReviewStatus.PUBLISHED },
        _count: { _all: true },
      }),
    ]);

    const starMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of starCounts) {
      const r = Math.round(row.rating);
      if (r >= 1 && r <= 5) starMap[r] = row._count._all;
    }

    const rollupData = {
      averageRating: new Prisma.Decimal(published._avg.rating ?? 0),
      reviewCount: totalCount,
      publishedCount: published._count._all,
      pendingCount,
      flaggedCount,
      star1: starMap[1],
      star2: starMap[2],
      star3: starMap[3],
      star4: starMap[4],
      star5: starMap[5],
      lastReviewAt: published._max.createdAt ?? null,
    };

    await prisma.sellerReviewRollup.upsert({
      where: { sellerId },
      create: { sellerId, ...rollupData },
      update: rollupData,
    });

    await this.syncTrustSeed(prisma, sellerId);
  }

  private async syncTrustSeed(prisma: Prisma.TransactionClient, sellerId: string): Promise<void> {
    const rollup = await prisma.sellerReviewRollup.findUnique({ where: { sellerId } });
    const label = 'review:aggregate';

    if (!rollup || rollup.publishedCount === 0) {
      await prisma.trustScoreSeed.deleteMany({ where: { userId: sellerId, label } });
      await this.recalculateTrustScore(prisma, sellerId);
      return;
    }

    const value = Math.round(Number(rollup.averageRating) * 2);
    const existingSeed = await prisma.trustScoreSeed.findFirst({ where: { userId: sellerId, label } });

    if (existingSeed) {
      await prisma.trustScoreSeed.update({ where: { id: existingSeed.id }, data: { value } });
    } else {
      await prisma.trustScoreSeed.create({ data: { userId: sellerId, label, value, metadata: { source: 'reviews' } } });
    }

    await this.recalculateTrustScore(prisma, sellerId);
  }

  private async recalculateTrustScore(prisma: Prisma.TransactionClient, userId: string): Promise<void> {
    const aggregate = await prisma.trustScoreSeed.aggregate({ where: { userId }, _sum: { value: true } });
    await prisma.user.update({ where: { id: userId }, data: { trustScore: aggregate._sum.value ?? 0 } });
  }

  private buildMetadata(metadata?: Record<string, unknown>): Prisma.JsonObject | undefined {
    if (!metadata || Object.keys(metadata).length === 0) {
      return undefined;
    }

    return metadata as Prisma.JsonObject;
  }
}
