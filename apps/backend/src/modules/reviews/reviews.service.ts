import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';

import { PrismaService } from "../../prisma/prisma.service";
import { CreateReviewDto, UpdateReviewDto } from "./dto/create-review.dto";
import { ReviewModerationService } from "./moderation.service";
import { ListingReviewResponse, ReviewRollup, SafeReview, serializeReview, serializeRollup } from "./review.serializer";

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService, private readonly moderation: ReviewModerationService) { }

  async listForListing(listingId: string): Promise<ListingReviewResponse> {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, deletedAt: null } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const [reviews, rollupRecord] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { listingId, status: ReviewStatus.PUBLISHED },
        orderBy: { createdAt: 'desc' },
        include: { reviewer: true, flags: true },
      }),
      this.prisma.sellerReviewRollup.findUnique({ where: { sellerId: listing.sellerId } }),
    ]);

    return {
      reviews: reviews.map((review) => serializeReview(review)),
      rollup: serializeRollup(rollupRecord, listing.sellerId),
    };
  }

  async getRollup(sellerId: string): Promise<ReviewRollup> {
    const rollup = await this.prisma.sellerReviewRollup.findUnique({ where: { sellerId } });
    return serializeRollup(rollup, sellerId);
  }

  async findById(id: string): Promise<SafeReview> {
    const review = await this.prisma.review.findFirst({
      where: { id },
      include: { reviewer: true, flags: true },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return serializeReview(review);
  }

  async create(dto: CreateReviewDto): Promise<SafeReview> {
    await this.ensureListing(dto.listingId, dto.recipientId);
    await this.ensureOrder(dto.orderId, dto.reviewerId, dto.recipientId, dto.listingId);

    const moderation = this.moderation.evaluate(dto.comment ?? '', dto.rating);

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          reviewerId: dto.reviewerId,
          recipientId: dto.recipientId,
          listingId: dto.listingId,
          orderId: dto.orderId,
          rating: dto.rating,
          comment: dto.comment,
          status: moderation.status,
          moderationNotes: moderation.notes,
          metadata: this.buildMetadata(dto.metadata),
        },
        include: { reviewer: true },
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
      include: { reviewer: true, flags: true },
    });

    return serializeReview(createdWithFlags!);
  }

  async update(id: string, dto: UpdateReviewDto): Promise<SafeReview> {
    const existing = await this.prisma.review.findFirst({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Review not found');
    }

    const moderation = this.moderation.evaluate(dto.comment ?? existing.comment ?? '', dto.rating ?? existing.rating);
    const status = dto.status ?? moderation.status ?? existing.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.reviewFlag.deleteMany({ where: { reviewId: id } });

      const review = await tx.review.update({
        where: { id },
        data: {
          rating: dto.rating ?? existing.rating,
          comment: dto.comment ?? existing.comment,
          status,
          moderationNotes: moderation.notes ?? existing.moderationNotes,
          metadata: (this.buildMetadata(dto.metadata) ?? existing.metadata) as any,
        },
        include: { reviewer: true },
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
      include: { reviewer: true, flags: true },
    });

    return serializeReview(reloaded!);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.review.findFirst({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Review not found');
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

  private async ensureOrder(orderId: string, buyerId: string, sellerId: string, listingId: string): Promise<void> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, buyerId, sellerId, items: { some: { listingId } } } });
    if (!order) {
      throw new BadRequestException('Order not found for reviewer and seller');
    }
  }

  private async refreshRollups(prisma: Prisma.TransactionClient, sellerId: string): Promise<void> {
    const [published, pendingCount, flaggedCount, totalCount] = await Promise.all([
      prisma.review.aggregate({
        where: { recipientId: sellerId, status: ReviewStatus.PUBLISHED },
        _avg: { rating: true },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.review.count({ where: { recipientId: sellerId, status: ReviewStatus.PENDING } }),
      prisma.reviewFlag.count({ where: { review: { recipientId: sellerId } } }),
      prisma.review.count({ where: { recipientId: sellerId } }),
    ]);

    await prisma.sellerReviewRollup.upsert({
      where: { sellerId },
      create: {
        sellerId,
        averageRating: new Prisma.Decimal(published._avg.rating ?? 0),
        reviewCount: totalCount,
        publishedCount: published._count._all,
        pendingCount,
        flaggedCount,
        lastReviewAt: published._max.createdAt ?? null,
      },
      update: {
        averageRating: new Prisma.Decimal(published._avg.rating ?? 0),
        reviewCount: totalCount,
        publishedCount: published._count._all,
        pendingCount,
        flaggedCount,
        lastReviewAt: published._max.createdAt ?? null,
      },
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
