import { ReviewStatus, SellerReviewRollup } from "@prisma/client";

export interface SafeReviewFlag {
  id: string;
  reason: string;
  notes?: string | null;
  createdAt: Date;
}

export interface PublicReviewer {
  id: string;
  name: string;
  avatarUrl: string | null;
  trustScore: number;
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
  verifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
  reviewer?: PublicReviewer | null;
  flags: SafeReviewFlag[];
  helpfulCount: number;
  userVoted: boolean;
}

export interface ReviewRollup {
  sellerId: string;
  averageRating: number;
  reviewCount: number;
  publishedCount: number;
  pendingCount: number;
  flaggedCount: number;
  star1: number;
  star2: number;
  star3: number;
  star4: number;
  star5: number;
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
  verifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
  reviewer?: {
    id: string;
    name: string;
    avatarUrl: string | null;
    trustScore: number;
    createdAt: Date;
  } | null;
  flags?: Array<{
    id: string;
    reason: string;
    notes: string | null;
    createdAt: Date;
  }>;
  votes?: Array<{ userId: string; isHelpful: boolean }>;
};

export const serializeReview = (
  review: ReviewWithRelations,
  viewerId?: string,
): SafeReview => ({
  id: review.id,
  reviewerId: review.reviewerId,
  recipientId: review.recipientId,
  listingId: review.listingId,
  orderId: review.orderId,
  rating: review.rating,
  comment: review.comment,
  status: review.status,
  moderationNotes: review.moderationNotes,
  verifiedPurchase: review.verifiedPurchase,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  reviewer: review.reviewer
    ? {
        id: review.reviewer.id,
        name: review.reviewer.name,
        avatarUrl: review.reviewer.avatarUrl,
        trustScore: review.reviewer.trustScore,
        createdAt: review.reviewer.createdAt,
      }
    : null,
  flags:
    review.flags?.map((flag) => ({
      id: flag.id,
      reason: flag.reason,
      notes: flag.notes,
      createdAt: flag.createdAt,
    })) ?? [],
  helpfulCount: review.votes?.filter((v) => v.isHelpful).length ?? 0,
  userVoted: viewerId
    ? (review.votes?.some((v) => v.userId === viewerId && v.isHelpful) ?? false)
    : false,
});

export const serializeRollup = (
  rollup: SellerReviewRollup | null,
  sellerId: string,
): ReviewRollup => ({
  sellerId,
  averageRating: Number(rollup?.averageRating ?? 0),
  reviewCount: rollup?.reviewCount ?? 0,
  publishedCount: rollup?.publishedCount ?? 0,
  pendingCount: rollup?.pendingCount ?? 0,
  flaggedCount: rollup?.flaggedCount ?? 0,
  star1: (rollup as any)?.star1 ?? 0,
  star2: (rollup as any)?.star2 ?? 0,
  star3: (rollup as any)?.star3 ?? 0,
  star4: (rollup as any)?.star4 ?? 0,
  star5: (rollup as any)?.star5 ?? 0,
  lastReviewAt: rollup?.lastReviewAt ?? null,
});
