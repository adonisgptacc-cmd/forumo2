import {
  AuthResponse,
  CreateListingDto,
  UpdateListingDto,
  CreateOrderDto,
  CreateOfferDto,
  CreateThreadDto,
  ListingCategory,
  ListingImage,
  ListingSearchParams,
  ListingSearchResponse,
  ListingReviewResponse,
  ListingTag,
  AdminDisputeSummary,
  AdminKycSubmission,
  AdminListingModeration,
  CreateReviewDto,
  SafeListing,
  SafeMessageThread,
  SafeNotification,
  SafeOffer,
  SafeOrder,
  SafeReview,
  SafeUser,
  SavedListing,
  SendMessageDto,
  UpdateOrderStatusDto,
  ReviewRollup,
  PaginatedResponse,
  Storefront,
  CreateStorefrontDto,
  Auction,
  CreateAuctionDto,
  PlaceBidDto,
  createReviewSchema,
  createOfferSchema,
  listingSearchParamsSchema,
  listingSearchResponseSchema,
  safeListingSchema,
  safeNotificationSchema,
  savedListingSchema,
  safeOfferSchema,
  safeUserSchema,
  listingReviewResponseSchema,
  adminDisputeSchema,
  adminKycSubmissionSchema,
  adminListingModerationSchema,
  messageThreadSchema,
  safeOrderSchema,
  reviewSchema,
  reviewRollupSchema,
  authResponseSchema,
  storefrontSchema,
  createStorefrontSchema,
  auctionSchema,
  createAuctionSchema,
  placeBidSchema,
} from './types';

export interface UpdateProfilePayload {
  name?: string;
  avatarUrl?: string;
  phone?: string;
}

export interface UserProfileData {
  user: SafeUser;
  profile: {
    userId: string;
    bio?: string | null;
    website?: string | null;
    location?: string | null;
    socialLinks?: Record<string, string> | null;
  } | null;
  trustSeeds: Array<{
    id: string;
    label: string;
    value: number;
    createdAt: string;
  }>;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ForumoApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getAccessToken?: () => string | Promise<string | undefined> | undefined;
}

export class ForumoApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly getAccessToken?: () => string | Promise<string | undefined> | undefined;

  constructor(options: ForumoApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch?.bind(globalThis) as typeof fetch);
    if (!this.fetchImpl) {
      throw new Error('Fetch implementation not available');
    }
    this.getAccessToken = options.getAccessToken;
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>) {
    const relativePath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(relativePath, `${this.baseUrl}/`);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }
    return url.toString();
  }

  private async request<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
    const headers = new Headers(init.headers);
    const bodyIsFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
    if (!bodyIsFormData && init.method && init.method !== 'GET' && init.method !== 'HEAD') {
      headers.set('Content-Type', 'application/json');
    }

    if (init.auth) {
      const token = (await this.getAccessToken?.()) ?? undefined;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const response = await this.fetchImpl(this.buildUrl(path), { ...init, headers });
    const text = await response.text();
    const payload = text ? safeJsonParse(text) : undefined;

    if (!response.ok) {
      const message = typeof payload?.message === 'string' ? payload.message : response.statusText;
      throw new ApiError(message, response.status, payload);
    }

    return payload as T;
  }

  private async requestJson<T>(path: string, options: Omit<RequestInit, 'body'> & { auth?: boolean; body?: unknown } = {}): Promise<T> {
    const body =
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body;
    return this.request<T>(path, { ...options, body: body as any });
  }

  async get<T>(path: string, options: Omit<RequestInit, 'body' | 'method'> & { auth?: boolean } = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T>(path: string, body?: unknown, options: Omit<RequestInit, 'body' | 'method'> & { auth?: boolean } = {}): Promise<T> {
    return this.requestJson<T>(path, { ...options, method: 'POST', body });
  }

  async put<T>(path: string, body?: unknown, options: Omit<RequestInit, 'body' | 'method'> & { auth?: boolean } = {}): Promise<T> {
    return this.requestJson<T>(path, { ...options, method: 'PUT', body });
  }

  async patch<T>(path: string, body?: unknown, options: Omit<RequestInit, 'body' | 'method'> & { auth?: boolean } = {}): Promise<T> {
    return this.requestJson<T>(path, { ...options, method: 'PATCH', body });
  }

  async delete<T>(path: string, options: Omit<RequestInit, 'body' | 'method'> & { auth?: boolean } = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  readonly auth = {
    login: async (payload: { email: string; password: string }): Promise<AuthResponse> => {
      const response = await this.requestJson<AuthResponse>('/auth/login', {
        method: 'POST',
        body: payload,
      });
      return authResponseSchema.parse(response);
    },
    register: async (payload: { name: string; email: string; password: string; phone?: string }): Promise<AuthResponse> => {
      const response = await this.requestJson<AuthResponse>('/auth/register', {
        method: 'POST',
        body: payload,
      });
      return authResponseSchema.parse(response);
    },
    me: async (): Promise<AuthResponse> => {
      const response = await this.requestJson<AuthResponse>('/auth/me', {
        method: 'GET',
        auth: true,
      });
      return authResponseSchema.parse(response);
    },
  };

  readonly listings = {
    search: async (params: Partial<ListingSearchParams> = {}): Promise<ListingSearchResponse> => {
      const parsed = listingSearchParamsSchema.parse({
        page: Number(params.page ?? 1),
        pageSize: Number(params.pageSize ?? 12),
        keyword: params.keyword,
        sellerId: params.sellerId,
        status: params.status,
        minPriceCents: params.minPriceCents !== undefined ? Number(params.minPriceCents) : undefined,
        maxPriceCents: params.maxPriceCents !== undefined ? Number(params.maxPriceCents) : undefined,
        tags: params.tags,
        sort: params.sort,
        categories: params.categories,
      });
      const result = await this.request<ListingSearchResponse>(
        `/listings/search${buildQuery(parsed)}`,
        {
          method: 'GET',
        },
      );
      return listingSearchResponseSchema.parse(result);
    },
    get: async (id: string): Promise<SafeListing> => {
      const result = await this.requestJson<SafeListing>(`/listings/${id}`, { method: 'GET' });
      return safeListingSchema.parse(result);
    },
    create: async (payload: CreateListingDto): Promise<SafeListing> => {
      const result = await this.requestJson<SafeListing>('/listings', {
        method: 'POST',
        auth: true,
        body: payload,
      });
      return safeListingSchema.parse(result);
    },
    update: async (id: string, payload: UpdateListingDto): Promise<SafeListing> => {
      const result = await this.requestJson<SafeListing>(`/listings/${id}`, {
        method: 'PATCH',
        auth: true,
        body: payload,
      });
      return safeListingSchema.parse(result);
    },
    delete: async (id: string): Promise<void> => {
      await this.delete<void>(`/listings/${id}`, { auth: true });
    },
    uploadImage: async (listingId: string, file: Blob): Promise<ListingImage> => {
      const formData = new FormData();
      formData.append('file', file);
      return this.request<ListingImage>(`/listings/${listingId}/images`, {
        method: 'POST',
        auth: true,
        body: formData,
      });
    },
  };

  readonly orders = {
    list: async (): Promise<SafeOrder[]> => {
      const response = await this.requestJson<SafeOrder[]>('/orders', { method: 'GET', auth: true });
      return response.map((order) => safeOrderSchema.parse(order));
    },
    get: async (id: string): Promise<SafeOrder> => {
      const response = await this.requestJson<SafeOrder>(`/orders/${id}`, { method: 'GET', auth: true });
      return safeOrderSchema.parse(response);
    },
    create: async (payload: CreateOrderDto): Promise<SafeOrder> => {
      const response = await this.requestJson<SafeOrder>('/orders', {
        method: 'POST',
        auth: true,
        body: payload,
      });
      return safeOrderSchema.parse(response);
    },
    updateStatus: async (id: string, payload: UpdateOrderStatusDto): Promise<SafeOrder> => {
      const response = await this.requestJson<SafeOrder>(`/orders/${id}/status`, {
        method: 'PATCH',
        auth: true,
        body: payload,
      });
      return safeOrderSchema.parse(response);
    },
    initiatePayment: async (orderId: string): Promise<{ clientSecret: string }> => {
      const response = await this.requestJson<{ clientSecret: string }>(`/orders/${orderId}/initiate-payment`, {
        method: 'POST',
        auth: true,
      });
      return response;
    },
  };

  readonly reviews = {
    forListing: async (listingId: string): Promise<ListingReviewResponse> => {
      const result = await this.request<ListingReviewResponse>(`/reviews${buildQuery({ listingId })}`, {
        method: 'GET',
      });
      return listingReviewResponseSchema.parse(result);
    },
    create: async (payload: CreateReviewDto): Promise<SafeReview> => {
      const parsed = createReviewSchema.parse(payload);
      const result = await this.requestJson<SafeReview>('/reviews', {
        method: 'POST',
        auth: true,
        body: parsed,
      });
      return reviewSchema.parse(result);
    },
    rollup: async (sellerId: string): Promise<ReviewRollup> => {
      const result = await this.request<ReviewRollup>(`/reviews/seller/${sellerId}/rollup`, { method: 'GET' });
      return reviewRollupSchema.parse(result);
    },
  };

  readonly messaging = {
    listThreads: async (
      params: { userId?: string; listingId?: string; page?: number; pageSize?: number } = {},
    ): Promise<PaginatedResponse<SafeMessageThread>> => {
      const result = await this.request<PaginatedResponse<SafeMessageThread>>(
        `/messages/threads${buildQuery(params)}`,
        { method: 'GET', auth: true },
      );
      return {
        ...result,
        data: result.data.map((thread) => messageThreadSchema.parse(thread)),
      };
    },
    getThread: async (id: string): Promise<SafeMessageThread> => {
      const result = await this.request<SafeMessageThread>(`/messages/threads/${id}`, {
        method: 'GET',
        auth: true,
      });
      return messageThreadSchema.parse(result);
    },
    createThread: async (payload: CreateThreadDto): Promise<SafeMessageThread> => {
      const result = await this.requestJson<SafeMessageThread>('/messages/threads', {
        method: 'POST',
        auth: true,
        body: payload,
      });
      return messageThreadSchema.parse(result);
    },
    sendMessage: async (
      threadId: string,
      payload: SendMessageDto,
      attachments?: Blob[],
    ): Promise<SafeMessageThread> => {
      if (attachments?.length) {
        const formData = new FormData();
        formData.append('authorId', payload.authorId);
        formData.append('body', payload.body);
        if (payload.metadata) {
          formData.append('metadata', JSON.stringify(payload.metadata));
        }
        attachments.forEach((file) => formData.append('attachments', file));
        const result = await this.request<SafeMessageThread>(`/messages/threads/${threadId}/messages`, {
          method: 'POST',
          auth: true,
          body: formData as any,
        });
        return messageThreadSchema.parse(result);
      }
      const result = await this.requestJson<SafeMessageThread>(`/messages/threads/${threadId}/messages`, {
        method: 'POST',
        auth: true,
        body: payload,
      });
      return messageThreadSchema.parse(result);
    },
  };

  readonly notifications = {
    registerExpoPushToken: async (token: string): Promise<void> => {
      await this.requestJson<void>('/notifications/expo-token', {
        method: 'POST',
        auth: true,
        body: { token },
      });
    },
    list: async (): Promise<SafeNotification[]> => {
      const result = await this.request<SafeNotification[]>('/notifications', { method: 'GET', auth: true });
      return result.map((n) => safeNotificationSchema.parse(n));
    },
    unreadCount: async (): Promise<{ count: number }> => {
      return this.request<{ count: number }>('/notifications/unread-count', { method: 'GET', auth: true });
    },
    markAsRead: async (id: string): Promise<void> => {
      await this.requestJson<void>(`/notifications/${id}/read`, { method: 'PATCH', auth: true });
    },
    markAllAsRead: async (): Promise<void> => {
      await this.requestJson<void>('/notifications/mark-all-read', { method: 'POST', auth: true });
    },
  };

  readonly admin = {
    listKycSubmissions: async (): Promise<AdminKycSubmission[]> => {
      const result = await this.request<AdminKycSubmission[]>('/admin/kyc/submissions', {
        method: 'GET',
        auth: true,
      });
      return result.map((item) => adminKycSubmissionSchema.parse(item));
    },
    reviewKycSubmission: async (
      id: string,
      payload: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string | null },
    ): Promise<AdminKycSubmission> => {
      const result = await this.requestJson<AdminKycSubmission>(`/admin/kyc/submissions/${id}`, {
        method: 'PATCH',
        auth: true,
        body: payload,
      });
      return adminKycSubmissionSchema.parse(result);
    },
    listListingsForReview: async (): Promise<AdminListingModeration[]> => {
      const result = await this.request<AdminListingModeration[]>('/admin/moderations/listings', {
        method: 'GET',
        auth: true,
      });
      return result.map((item) => adminListingModerationSchema.parse(item));
    },
    reviewListing: async (
      id: string,
      payload: { moderationStatus: AdminListingModeration['moderationStatus']; moderationNotes?: string | null },
    ): Promise<AdminListingModeration> => {
      const result = await this.requestJson<AdminListingModeration>(`/admin/moderations/listings/${id}`, {
        method: 'PATCH',
        auth: true,
        body: payload,
      });
      return adminListingModerationSchema.parse(result);
    },
    listDisputes: async (): Promise<AdminDisputeSummary[]> => {
      const result = await this.request<AdminDisputeSummary[]>('/admin/disputes', { method: 'GET', auth: true });
      return result.map((item) => adminDisputeSchema.parse(item));
    },
    resolveDispute: async (
      id: string,
      payload: { status: AdminDisputeSummary['status']; resolution?: string | null },
    ): Promise<AdminDisputeSummary> => {
      const result = await this.requestJson<AdminDisputeSummary>(`/admin/disputes/${id}`, {
        method: 'PATCH',
        auth: true,
        body: payload,
      });
      return adminDisputeSchema.parse(result);
    },
  };

  readonly auctions = {
    list: async (params: { page?: number; pageSize?: number; status?: string } = {}): Promise<PaginatedResponse<Auction>> => {
      const result = await this.request<PaginatedResponse<Auction>>(
        `/auctions${buildQuery(params)}`,
        { method: 'GET' },
      );
      return {
        ...result,
        data: (result.data ?? []).map((a) => auctionSchema.parse(a)),
      };
    },
    create: async (payload: CreateAuctionDto): Promise<Auction> => {
      const parsed = createAuctionSchema.parse(payload);
      const result = await this.requestJson<Auction>('/auctions', {
        method: 'POST',
        auth: true,
        body: parsed,
      });
      return auctionSchema.parse(result);
    },
    get: async (id: string): Promise<Auction> => {
      const result = await this.requestJson<Auction>(`/auctions/${id}`, { method: 'GET' });
      return auctionSchema.parse(result);
    },
    placeBid: async (id: string, payload: PlaceBidDto): Promise<Auction> => {
      const parsed = placeBidSchema.parse(payload);
      const result = await this.requestJson<Auction>(`/auctions/${id}/bids`, {
        method: 'POST',
        auth: true,
        body: parsed,
      });
      return auctionSchema.parse(result);
    },
  };

  readonly categories = {
    list: async (): Promise<ListingCategory[]> => {
      return this.request<ListingCategory[]>('/categories', { method: 'GET' });
    },
    listTags: async (): Promise<ListingTag[]> => {
      return this.request<ListingTag[]>('/categories/tags', { method: 'GET' });
    },
    createCategory: async (payload: { slug: string; name: string; description?: string; parentId?: string; position?: number }): Promise<ListingCategory> => {
      return this.requestJson<ListingCategory>('/categories', { method: 'POST', auth: true, body: payload });
    },
    updateCategory: async (id: string, payload: { name?: string; description?: string; parentId?: string; position?: number }): Promise<ListingCategory> => {
      return this.requestJson<ListingCategory>(`/categories/${id}`, { method: 'PATCH', auth: true, body: payload });
    },
    deleteCategory: async (id: string): Promise<void> => {
      await this.request<void>(`/categories/${id}`, { method: 'DELETE', auth: true });
    },
    createTag: async (payload: { slug: string; label: string }): Promise<ListingTag> => {
      return this.requestJson<ListingTag>('/categories/tags', { method: 'POST', auth: true, body: payload });
    },
    updateTag: async (id: string, payload: { label?: string }): Promise<ListingTag> => {
      return this.requestJson<ListingTag>(`/categories/tags/${id}`, { method: 'PATCH', auth: true, body: payload });
    },
    deleteTag: async (id: string): Promise<void> => {
      await this.request<void>(`/categories/tags/${id}`, { method: 'DELETE', auth: true });
    },
    assignCategories: async (listingId: string, categoryIds: string[], primaryCategoryId?: string): Promise<void> => {
      await this.requestJson<void>(`/categories/listings/${listingId}/categories`, {
        method: 'POST',
        auth: true,
        body: { categoryIds, primaryCategoryId },
      });
    },
    assignTags: async (listingId: string, tagIds: string[]): Promise<void> => {
      await this.requestJson<void>(`/categories/listings/${listingId}/tags`, {
        method: 'POST',
        auth: true,
        body: { tagIds },
      });
    },
  };

  readonly wishlist = {
    list: async (): Promise<SavedListing[]> => {
      const result = await this.request<SavedListing[]>('/wishlist', { method: 'GET', auth: true });
      return result.map((s) => savedListingSchema.parse(s));
    },
    save: async (listingId: string): Promise<SavedListing> => {
      const result = await this.requestJson<SavedListing>(`/wishlist/${listingId}`, {
        method: 'POST',
        auth: true,
      });
      return savedListingSchema.parse(result);
    },
    remove: async (listingId: string): Promise<void> => {
      await this.request<void>(`/wishlist/${listingId}`, { method: 'DELETE', auth: true });
    },
    check: async (listingId: string): Promise<{ saved: boolean }> => {
      return this.request<{ saved: boolean }>(`/wishlist/${listingId}/check`, {
        method: 'GET',
        auth: true,
      });
    },
  };

  readonly offers = {
    list: async (): Promise<SafeOffer[]> => {
      const result = await this.request<SafeOffer[]>('/offers', { method: 'GET', auth: true });
      return result.map((o) => safeOfferSchema.parse(o));
    },
    create: async (payload: CreateOfferDto): Promise<SafeOffer> => {
      const parsed = createOfferSchema.parse(payload);
      const result = await this.requestJson<SafeOffer>('/offers', {
        method: 'POST',
        auth: true,
        body: parsed,
      });
      return safeOfferSchema.parse(result);
    },
    accept: async (id: string): Promise<SafeOffer> => {
      const result = await this.requestJson<SafeOffer>(`/offers/${id}/accept`, {
        method: 'POST',
        auth: true,
      });
      return safeOfferSchema.parse(result);
    },
    decline: async (id: string): Promise<SafeOffer> => {
      const result = await this.requestJson<SafeOffer>(`/offers/${id}/decline`, {
        method: 'POST',
        auth: true,
      });
      return safeOfferSchema.parse(result);
    },
  };

  readonly users = {
    getProfile: async (): Promise<UserProfileData> => {
      return this.request<UserProfileData>('/users/me/profile', { method: 'GET', auth: true });
    },
    updateProfile: async (payload: UpdateProfilePayload): Promise<SafeUser> => {
      const result = await this.requestJson<SafeUser>('/users/me/profile', {
        method: 'PATCH',
        auth: true,
        body: payload,
      });
      return safeUserSchema.parse(result);
    },
    deleteAvatar: async (): Promise<SafeUser> => {
      const result = await this.request<SafeUser>('/users/me/avatar', { method: 'DELETE', auth: true });
      return safeUserSchema.parse(result);
    },
  };

  readonly storefronts = {
    create: async (payload: CreateStorefrontDto): Promise<Storefront> => {
      const parsed = createStorefrontSchema.parse(payload);
      const result = await this.requestJson<Storefront>('/storefronts', {
        method: 'POST',
        auth: true,
        body: parsed,
      });
      return storefrontSchema.parse(result);
    },
    get: async (slug: string): Promise<Storefront> => {
      const result = await this.requestJson<Storefront>(`/storefronts/${slug}`, { method: 'GET' });
      return storefrontSchema.parse(result);
    },
    getMine: async (): Promise<Storefront | null> => {
      try {
        const result = await this.request<Storefront>('/storefronts/me', { method: 'GET', auth: true });
        return result ? storefrontSchema.parse(result) : null;
      } catch {
        return null;
      }
    },
    update: async (payload: { name?: string; description?: string; logoUrl?: string; bannerUrl?: string }): Promise<Storefront> => {
      const result = await this.requestJson<Storefront>('/storefronts/me', {
        method: 'PATCH',
        auth: true,
        body: payload,
      });
      return storefrontSchema.parse(result);
    },
    remove: async (): Promise<void> => {
      await this.request<void>('/storefronts/me', { method: 'DELETE', auth: true });
    },
    listCollections: async (): Promise<Array<{ id: string; name: string; slug: string; description: string | null; productIds: string[]; createdAt: string }>> => {
      return this.request('/storefronts/me/collections', { method: 'GET', auth: true });
    },
    createCollection: async (payload: { name: string; slug: string; description?: string; productIds?: string[] }) => {
      return this.requestJson('/storefronts/me/collections', { method: 'POST', auth: true, body: payload });
    },
    updateCollection: async (id: string, payload: { name?: string; description?: string; productIds?: string[] }) => {
      return this.requestJson(`/storefronts/me/collections/${id}`, { method: 'PATCH', auth: true, body: payload });
    },
    deleteCollection: async (id: string): Promise<void> => {
      await this.request<void>(`/storefronts/me/collections/${id}`, { method: 'DELETE', auth: true });
    },
  };
}

function buildQuery(params: Record<string, string | number | string[] | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== '') {
          query.append(key, String(item));
        }
      });
      return;
    }
    query.append(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}
