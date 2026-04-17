'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateListingDto,
  CreateOfferDto,
  CreateOrderDto,
  CreateReviewDto,
  ListingCategory,
  ListingSearchParams,
  ListingSearchResponse,
  ListingTag,
  SafeListing,
  SafeMessageThread,
  SafeNotification,
  SafeOffer,
  SafeOrder,
  SafeReview,
  SafeUser,
  SavedListing,
  SendMessageDto,
  UpdateListingDto,
  ListingReviewResponse,
  ReviewRollup,
  PaginatedResponse,
  UpdateProfilePayload,
  UserProfileData,
} from '@forumo/shared';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

import { createApiClient } from '../api-client';
import { MessagingLayer } from '../messaging-layer';
import { queryKeys } from './query-keys';

function useApi(accessToken?: string | null) {
  return useMemo(() => createApiClient(accessToken), [accessToken]);
}

function useMessagingLayer(accessToken?: string | null) {
  return useMemo(() => new MessagingLayer(accessToken), [accessToken]);
}

export function useCurrentUser() {
  const { data, status } = useSession();
  return { user: data?.user, accessToken: data?.accessToken, status };
}

export function useListings(params: Partial<ListingSearchParams>) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<ListingSearchResponse>({
    queryKey: queryKeys.listings(params),
    queryFn: () => api.listings.search(params),
  });
}

export function useListing(id: string | null) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<SafeListing | null>({
    queryKey: id ? queryKeys.listing(id) : ['listing', null],
    queryFn: () => (id ? api.listings.get(id) : Promise.resolve(null)),
    enabled: Boolean(id),
  });
}

export function useListingReviews(listingId: string | null) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<ListingReviewResponse | null>({
    queryKey: listingId ? queryKeys.listingReviews(listingId) : ['listing', null, 'reviews'],
    queryFn: () => (listingId ? api.reviews.forListing(listingId) : Promise.resolve(null)),
    enabled: Boolean(listingId),
  });
}

export function useReviewMutations() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();

  const createReview = useMutation({
    mutationFn: (payload: CreateReviewDto) => api.reviews.create(payload),
    onSuccess: (review: SafeReview) => {
      client.invalidateQueries({ queryKey: queryKeys.listingReviews(review.listingId) });
      client.invalidateQueries({ queryKey: queryKeys.sellerReviewRollup(review.recipientId) });
    },
  });

  return { createReview };
}

export function useSellerReviewRollup(sellerId: string | null) {
  const api = useApi();
  return useQuery<ReviewRollup | null>({
    queryKey: sellerId ? queryKeys.sellerReviewRollup(sellerId) : ['seller', null, 'reviews'],
    queryFn: () => (sellerId ? api.reviews.rollup(sellerId) : Promise.resolve(null)),
    enabled: Boolean(sellerId),
  });
}

export function useListingMutations() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload: CreateListingDto) => api.listings.create(payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['listings'], exact: false });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateListingDto }) => api.listings.update(id, payload),
    onSuccess: (_, { id }) => {
      client.invalidateQueries({ queryKey: queryKeys.listing(id) });
      client.invalidateQueries({ queryKey: ['listings'], exact: false });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: ({ listingId, file }: { listingId: string; file: File }) =>
      api.listings.uploadImage(listingId, file),
    onSuccess: (_, { listingId }) => {
      client.invalidateQueries({ queryKey: queryKeys.listing(listingId) });
    },
  });

  const reportListingMutation = useMutation({
    mutationFn: ({ listingId, reason }: { listingId: string; reason: string }) =>
      api.listings.report(listingId, reason),
  });

  const deleteListingMutation = useMutation({
    mutationFn: (id: string) => api.listings.delete(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['listings'], exact: false });
    },
  });

  return { createMutation, updateMutation, uploadImageMutation, deleteListingMutation, reportListingMutation };
}

export function useOrders() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<SafeOrder[]>({
    queryKey: queryKeys.orders,
    queryFn: () => api.orders.list(),
  });
}

export function useOrder(id: string | null) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<SafeOrder | null>({
    queryKey: queryKeys.order(id ?? ''),
    queryFn: () => (id ? api.orders.get(id) : null),
    enabled: !!id && !!accessToken,
  });
}

export function useUpdateOrderStatus() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; status: import('@forumo/shared').OrderStatus; note?: string }) =>
      api.orders.updateStatus(id, payload),
    onSuccess: (_, { id }) => {
      client.invalidateQueries({ queryKey: queryKeys.orders });
      client.invalidateQueries({ queryKey: queryKeys.order(id) });
    },
  });
}

export function useCreateOrder() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrderDto) => api.orders.create(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.orders }),
  });
}

export function useInitiatePayment() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useMutation({
    mutationFn: (orderId: string) => api.orders.initiatePayment(orderId),
  });
}

export function useShipmentMutations(orderId: string) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();

  const createShipment = useMutation({
    mutationFn: (payload: { carrier?: string; trackingNumber?: string; serviceLevel?: string; estimatedDelivery?: string }) =>
      api.orders.createShipment(orderId, payload),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.order(orderId) }),
  });

  const updateShipment = useMutation({
    mutationFn: (payload: { carrier?: string; trackingNumber?: string; serviceLevel?: string; status?: string; estimatedDelivery?: string; deliveredAt?: string }) =>
      api.orders.updateShipment(orderId, payload),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.order(orderId) }),
  });

  return { createShipment, updateShipment };
}

export function useMessageThreads(userId?: string, page = 1) {
  const { accessToken, user } = useCurrentUser();
  const messaging = useMessagingLayer(accessToken);
  const targetUserId = userId ?? user?.id;
  return useQuery<PaginatedResponse<SafeMessageThread>>({
    queryKey: queryKeys.threads(targetUserId, page),
    queryFn: () => messaging.listThreads({ userId: targetUserId ?? undefined, page }),
    enabled: Boolean(accessToken),
  });
}

export function useThread(id: string | null) {
  const { accessToken } = useCurrentUser();
  const messaging = useMessagingLayer(accessToken);
  return useQuery<SafeMessageThread | null>({
    queryKey: id ? queryKeys.thread(id) : ['thread', null],
    queryFn: () => (id ? messaging.getThread(id) : Promise.resolve(null)),
    enabled: Boolean(id && accessToken),
    refetchInterval: 30000,
  });
}

export function useSendMessage(threadId: string) {
  const { accessToken, user } = useCurrentUser();
  const messaging = useMessagingLayer(accessToken);
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, attachments }: { payload: SendMessageDto; attachments?: Blob[] }) =>
      messaging.sendMessage(threadId, payload, attachments),
    onSuccess: (_, { payload }) => {
      client.invalidateQueries({ queryKey: queryKeys.thread(threadId) });
      client.invalidateQueries({ queryKey: ['threads'], exact: false });
    },
  });
}

export function useNotifications() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<SafeNotification[]>({
    queryKey: queryKeys.notifications,
    queryFn: () => api.notifications.list(),
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
  });
}

export function useUnreadCount() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<{ count: number }>({
    queryKey: queryKeys.notificationUnreadCount,
    queryFn: () => api.notifications.unreadCount(),
    enabled: Boolean(accessToken),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.notifications.markAsRead(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.notifications });
      client.invalidateQueries({ queryKey: queryKeys.notificationUnreadCount });
    },
  });
}

export function useMarkAllRead() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.notifications.markAllAsRead(),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.notifications });
      client.invalidateQueries({ queryKey: queryKeys.notificationUnreadCount });
    },
  });
}

export function useProfile() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<UserProfileData>({
    queryKey: queryKeys.profile,
    queryFn: () => api.users.getProfile(),
    enabled: !!accessToken,
  });
}

export function useUpdateProfile() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation<SafeUser, Error, UpdateProfilePayload>({
    mutationFn: (payload) => api.users.updateProfile(payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

export function useDeleteAvatar() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation<SafeUser, Error, void>({
    mutationFn: () => api.users.deleteAvatar(),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

export function useAddresses() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<any[]>({
    queryKey: ['addresses'],
    queryFn: () => api.users.listAddresses(),
    enabled: !!accessToken,
  });
}

export function useAddressMutations() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: ['addresses'] });
  return {
    create: useMutation({ mutationFn: (payload: any) => api.users.createAddress(payload), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, ...payload }: any) => api.users.updateAddress(id, payload), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => api.users.deleteAddress(id), onSuccess: invalidate }),
  };
}

export function useChangePassword() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useMutation<{ message: string }, Error, { currentPassword: string; newPassword: string }>({
    mutationFn: (payload) => api.auth.changePassword(payload),
  });
}

export function useOffers() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<SafeOffer[]>({
    queryKey: queryKeys.offers,
    queryFn: () => api.offers.list(),
    enabled: !!accessToken,
  });
}

export function useCreateOffer() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation<SafeOffer, Error, CreateOfferDto>({
    mutationFn: (payload) => api.offers.create(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.offers }),
  });
}

export function useAcceptOffer() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation<SafeOffer, Error, string>({
    mutationFn: (id) => api.offers.accept(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.offers });
      client.invalidateQueries({ queryKey: queryKeys.orders });
    },
  });
}

export function useDeclineOffer() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation<SafeOffer, Error, string>({
    mutationFn: (id) => api.offers.decline(id),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.offers }),
  });
}

export function useWishlist() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<SavedListing[]>({
    queryKey: queryKeys.wishlist,
    queryFn: () => api.wishlist.list(),
    enabled: !!accessToken,
  });
}

export function useWishlistCheck(listingId: string | null) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<{ saved: boolean }>({
    queryKey: queryKeys.wishlistCheck(listingId ?? ''),
    queryFn: () => api.wishlist.check(listingId!),
    enabled: !!listingId && !!accessToken,
  });
}

export function useSaveListing() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation<SavedListing, Error, string>({
    mutationFn: (listingId) => api.wishlist.save(listingId),
    onSuccess: (_, listingId) => {
      client.invalidateQueries({ queryKey: queryKeys.wishlist });
      client.invalidateQueries({ queryKey: queryKeys.wishlistCheck(listingId) });
    },
  });
}

export function useRemoveSavedListing() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (listingId) => api.wishlist.remove(listingId),
    onSuccess: (_, listingId) => {
      client.invalidateQueries({ queryKey: queryKeys.wishlist });
      client.invalidateQueries({ queryKey: queryKeys.wishlistCheck(listingId) });
    },
  });
}

export function useCategories() {
  const api = useApi();
  return useQuery<ListingCategory[]>({
    queryKey: queryKeys.categories,
    queryFn: () => api.categories.list(),
  });
}

export function useTags() {
  const api = useApi();
  return useQuery<ListingTag[]>({
    queryKey: queryKeys.tags,
    queryFn: () => api.categories.listTags(),
  });
}

export function useCategoryMutations() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.categories });

  const create = useMutation<ListingCategory, Error, { slug: string; name: string; description?: string; parentId?: string; position?: number }>({
    mutationFn: (payload) => api.categories.createCategory(payload),
    onSuccess: invalidate,
  });

  const update = useMutation<ListingCategory, Error, { id: string; name?: string; description?: string; parentId?: string; position?: number }>({
    mutationFn: ({ id, ...payload }) => api.categories.updateCategory(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: (id) => api.categories.deleteCategory(id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export function useTagMutations() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.tags });

  const create = useMutation<ListingTag, Error, { slug: string; label: string }>({
    mutationFn: (payload) => api.categories.createTag(payload),
    onSuccess: invalidate,
  });

  const update = useMutation<ListingTag, Error, { id: string; label?: string }>({
    mutationFn: ({ id, ...payload }) => api.categories.updateTag(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: (id) => api.categories.deleteTag(id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export function useMyStorefront() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery({
    queryKey: queryKeys.myStorefront,
    queryFn: () => api.storefronts.getMine(),
    enabled: !!accessToken,
  });
}

export function useSellerStorefront(sellerId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ['storefront', 'seller', sellerId],
    queryFn: () => api.storefronts.getBySeller(sellerId!),
    enabled: !!sellerId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStorefrontMutations() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  const invalidate = () => {
    client.invalidateQueries({ queryKey: queryKeys.myStorefront });
    client.invalidateQueries({ queryKey: queryKeys.myCollections });
  };

  const create = useMutation({
    mutationFn: (payload: { name: string; slug: string; description?: string }) => api.storefronts.create(payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (payload: { name?: string; description?: string }) => api.storefronts.update(payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: () => api.storefronts.remove(),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export function useMyCollections() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery({
    queryKey: queryKeys.myCollections,
    queryFn: () => api.storefronts.listCollections(),
    enabled: !!accessToken,
  });
}

export function useCollectionMutations() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.myCollections });

  const create = useMutation({
    mutationFn: (payload: { name: string; slug: string; description?: string; productIds?: string[] }) =>
      api.storefronts.createCollection(payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; description?: string; productIds?: string[] }) =>
      api.storefronts.updateCollection(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.storefronts.deleteCollection(id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// --- KYC ---

export interface KycSubmission {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  documents: Array<{ id: string; type: string; url: string; status: string }>;
}

export function useKycStatus() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<KycSubmission | null>({
    queryKey: ['kyc', 'status'],
    queryFn: async () => {
      try {
        return await api.get<KycSubmission>('/kyc/status', { auth: true });
      } catch {
        return null;
      }
    },
    enabled: !!accessToken,
  });
}

export function useSubmitKyc() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation<KycSubmission, Error, FormData>({
    mutationFn: (formData) =>
      api.post<KycSubmission>('/kyc/submit', formData, { auth: true }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['kyc', 'status'] }),
  });
}

// --- Seller Analytics ---

export interface SellerAnalytics {
  totalOrders: number;
  completedOrders: number;
  totalRevenueCents: number;
  avgOrderValueCents: number;
  ordersByStatus: Record<string, number>;
  revenueByMonth: Array<{ month: string; revenueCents: number; orderCount: number }>;
}

export function useSellerAnalytics() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<SellerAnalytics>({
    queryKey: ['seller', 'analytics'],
    queryFn: () => api.get<SellerAnalytics>('/orders/seller/analytics', { auth: true }),
    enabled: !!accessToken,
  });
}

// --- Admin ---

export interface AdminDashboardStats {
  totalUsers: number;
  activeListings: number;
  totalOrders: number;
  openDisputes: number;
  pendingKyc: number;
  pendingModeration: number;
}

export function useAdminDashboardStats() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<AdminDashboardStats>({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: () => api.get<AdminDashboardStats>('/admin/dashboard/stats', { auth: true }),
    enabled: !!accessToken,
    refetchInterval: 60_000,
  });
}

export interface AdminAnalytics {
  salesTrend: { label: string; value: number }[];
  userGrowth: { label: string; value: number }[];
  recentActivity: { title: string; meta: string; time: string; tone: string }[];
}

export function useAdminAnalytics() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<AdminAnalytics>({
    queryKey: ['admin', 'dashboard', 'analytics'],
    queryFn: () => api.get<AdminAnalytics>('/admin/dashboard/analytics', { auth: true }),
    enabled: !!accessToken,
    refetchInterval: 5 * 60_000,
  });
}

export function useAdminUsers() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<import('@forumo/shared').AdminUserDetail[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get('/admin/users', { auth: true }),
    enabled: !!accessToken,
  });
}

export function useAdminListings() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<import('@forumo/shared').AdminListingModeration[]>({
    queryKey: ['admin', 'listings'],
    queryFn: () => api.get('/admin/moderations/listings', { auth: true }),
    enabled: !!accessToken,
  });
}

export function useAdminOrders() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<import('@forumo/shared').AdminOrderSummary[]>({
    queryKey: ['admin', 'orders'],
    queryFn: () => api.get('/admin/orders', { auth: true }),
    enabled: !!accessToken,
  });
}

export function useAdminOrder(id: string | null) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<import('@forumo/shared').SafeOrder>({
    queryKey: ['admin', 'orders', id],
    queryFn: () => api.get(`/admin/orders/${id}`, { auth: true }),
    enabled: !!accessToken && !!id,
  });
}

// --- Auctions ---

export function useAuctions(params: { page?: number; pageSize?: number; status?: string; sort?: string; keyword?: string; sellerId?: string } = {}) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<import('@forumo/shared').PaginatedResponse<import('@forumo/shared').Auction>>({
    queryKey: queryKeys.auctions(params),
    queryFn: () => api.auctions.list(params),
  });
}

export function useCreateAuction() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: import('@forumo/shared').CreateAuctionDto) => api.auctions.create(payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['auctions'] });
    },
  });
}

// --- My Listings (seller) ---

export function useMyListings() {
  const { accessToken, user } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<import('@forumo/shared').ListingSearchResponse>({
    queryKey: queryKeys.myListings,
    queryFn: () => api.listings.search({ sellerId: user?.id, pageSize: 100 }),
    enabled: !!accessToken && !!user?.id,
  });
}

export function useDeleteListing() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.listings.delete(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.myListings });
      client.invalidateQueries({ queryKey: ['listings'], exact: false });
    },
  });
}

// --- Escrow Dispute ---

// --- Inventory ---

export function useVariantInventory(variantId: string | null | undefined) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery({
    queryKey: ['inventory', 'variant', variantId],
    queryFn: () => api.inventory.getByVariant(variantId!),
    enabled: !!accessToken && !!variantId,
  });
}

export function useInventoryMutations(variantId: string) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  const invalidate = () => {
    client.invalidateQueries({ queryKey: ['inventory', 'variant', variantId] });
    client.invalidateQueries({ queryKey: queryKeys.myListings });
  };
  const addStock = useMutation({
    mutationFn: (payload: { quantity: number; location?: string }) =>
      api.inventory.addStock(variantId, payload),
    onSuccess: invalidate,
  });
  const adjustStock = useMutation({
    mutationFn: (payload: { adjustment: number; reason: string }) =>
      api.inventory.adjustStock(variantId, payload),
    onSuccess: invalidate,
  });
  return { addStock, adjustStock };
}

export function useOpenDispute() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation<unknown, Error, { orderId: string; reason: string }>({
    mutationFn: ({ orderId, reason }) =>
      api.post(`/escrow/order/${orderId}/dispute`, { reason }, { auth: true }),
    onSuccess: (_, { orderId }) => {
      client.invalidateQueries({ queryKey: queryKeys.order(orderId) });
      client.invalidateQueries({ queryKey: queryKeys.orders });
    },
  });
}

export function useEscrowDetails(orderId: string | null) {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<unknown>({
    queryKey: orderId ? queryKeys.escrowDetails(orderId) : ['escrow', null],
    queryFn: () => api.get(`/escrow/order/${orderId}`, { auth: true }),
    enabled: Boolean(accessToken) && Boolean(orderId),
  });
}

export function useAddDisputeMessage() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation<unknown, Error, { disputeId: string; orderId: string; body: string }>({
    mutationFn: ({ disputeId, body }) =>
      api.post(`/escrow/disputes/${disputeId}/messages`, { body }, { auth: true }),
    onSuccess: (_, { orderId }) => {
      client.invalidateQueries({ queryKey: queryKeys.escrowDetails(orderId) });
    },
  });
}

export function useAcceptTerms() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useMutation<void, Error, void>({
    mutationFn: () => api.users.acceptTerms(),
  });
}

export function useExportMyData() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  return useQuery<Record<string, unknown>>({
    queryKey: ['user', 'export'],
    queryFn: () => api.users.exportData(),
    enabled: false,
  });
}

export function useBecomeSeller() {
  const { accessToken } = useCurrentUser();
  const api = useApi(accessToken);
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.users.becomeSeller(),
    onSuccess: () => {
      // Bust all user-related caches so the new role is reflected everywhere
      client.invalidateQueries({ queryKey: ['user'], exact: false });
      client.invalidateQueries({ queryKey: ['profile'], exact: false });
    },
  });
}
