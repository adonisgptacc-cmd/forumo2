export const queryKeys = {
  listings: (params: Record<string, unknown>) => ['listings', params] as const,
  listing: (id: string) => ['listing', id] as const,
  listingReviews: (listingId: string) => ['listing', listingId, 'reviews'] as const,
  sellerReviewRollup: (sellerId: string) => ['seller', sellerId, 'reviews'] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['orders', id] as const,
  threads: (userId?: string | null, page = 1) => ['threads', userId ?? 'self', page] as const,
  thread: (id: string) => ['thread', id] as const,
};
