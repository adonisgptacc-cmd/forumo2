import { ReviewStatus, SellerReviewRollup } from '@prisma/client';

import { SafeUser, sanitizeUser } from "../users/user.serializer";

export interface SafeReviewFlag {
  id: string;
  reason: string;
  notes?: string | null;
  createdAt: Date;
}

export interface SafeReview {
  id: string;
  reviewerId: string;
  recipientId: string;
  listingId: string;
  orderId: string;
  rating: number;
  comment?: string | null;
  status: ReviewStatus;
  moderationNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewer?: SafeUser | null;
  flags: SafeReviewFlag[];
}

export interface ReviewRollup {
  sellerId: string;
  averageRating: number;
  reviewCount: number;
  publishedCount: number;
  pendingCount: number;
  flaggedCount: number;
  lastReviewAt?: Date | null;
}

export interface ListingReviewResponse {
  reviews: SafeReview[];
  rollup: ReviewRollup;
}

type ReviewWithRelations = {
  id: string;
  reviewerId: string;
  recipientId: string;
  listingId: string;
  orderId: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  moderationNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewer?: SafeUser | null;
  flags?: Array<{ id: string; reason: string; notes: string | null; createdAt: Date }>;
};

export const serializeReview = (review: ReviewWithRelations): SafeReview => ({
  id: review.id,
  reviewerId: review.reviewerId,
  recipientId: review.recipientId,
  listingId: review.listingId,
  orderId: review.orderId,
  rating: review.rating,
  comment: review.comment,
  status: review.status,
  moderationNotes: review.moderationNotes,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  reviewer: sanitizeUser(review.reviewer ?? null),
  flags:
    review.flags?.map((flag) => ({ id: flag.id, reason: flag.reason, notes: flag.notes, createdAt: flag.createdAt })) ?? [],
});

export const serializeRollup = (rollup: SellerReviewRollup | null, sellerId: string): ReviewRollup => ({
  sellerId,
  averageRating: Number(rollup?.averageRating ?? 0),
  reviewCount: rollup?.reviewCount ?? 0,
  publishedCount: rollup?.publishedCount ?? 0,
  pendingCount: rollup?.pendingCount ?? 0,
  flaggedCount: rollup?.flaggedCount ?? 0,
  lastReviewAt: rollup?.lastReviewAt ?? null,
});
