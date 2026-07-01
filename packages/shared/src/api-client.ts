import {
  AuthResponse,
  TwoFactorRequired,
  TwoFactorSetupRequired,
  twoFactorRequiredSchema,
  twoFactorSetupRequiredSchema,
  CreateListingDto,
  UpdateListingDto,
  CreateOrderDto,
  CreateOfferDto,
  CreateFeeScheduleDto,
  UpdateFeeScheduleDto,
  FeeSchedule,
  FeePreview,
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
  SafeReturn,
  SafeUser,
  AdminUserDetail,
  SavedListing,
  SendMessageDto,
  UpdateOrderStatusDto,
  InitiateReturnDto,
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
  safeReturnSchema,
  safeUserSchema,
  listingReviewResponseSchema,
  adminDisputeSchema,
  adminKycSubmissionSchema,
  adminListingModerationSchema,
  adminUserDetailSchema,
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
  ShippoAddress,
  ShippoParcel,
  ShippingRate,
  PurchasedLabel,
  purchasedLabelSchema,
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
    login: async (payload: { email: string; password: string; deviceFingerprint?: string }): Promise<AuthResponse | TwoFactorRequired | TwoFactorSetupRequired> => {
      const response = await this.requestJson<AuthResponse | TwoFactorRequired | TwoFactorSetupRequired>('/auth/login', {
        method: 'POST',
        body: payload,
      });
      if (twoFactorRequiredSchema.safeParse(response).success) return twoFactorRequiredSchema.parse(response);
      if (twoFactorSetupRequiredSchema.safeParse(response).success) return twoFactorSetupRequiredSchema.parse(response);
      return authResponseSchema.parse(response);
    },
    refresh: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
      return this.requestJson<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshToken}` },
      });
    },
    setup2FAInit: async (twoFactorToken: string): Promise<{ qrCode: string; secret: string }> => {
      return this.requestJson('/auth/2fa/setup-init', {
        method: 'POST',
        headers: { Authorization: `Bearer ${twoFactorToken}` },
      });
    },
    setup2FAVerify: async (
      twoFactorToken: string,
      code: string,
      opts?: { rememberMe?: boolean; deviceFingerprint?: string },
    ): Promise<AuthResponse & { backupCodes: string[] }> => {
      return this.requestJson('/auth/2fa/setup-verify', {
        method: 'POST',
        body: { code, ...opts },
        headers: { Authorization: `Bearer ${twoFactorToken}` },
      });
    },
    verify2FA: async (
      twoFactorToken: string,
      code: string,
      opts?: { rememberMe?: boolean; deviceFingerprint?: string },
    ): Promise<AuthResponse> => {
      return this.requestJson('/auth/2fa/verify', {
        method: 'POST',
        body: { code, ...opts },
        headers: { Authorization: `Bearer ${twoFactorToken}` },
      });
    },
    disable2FA: async (code: string, password: string): Promise<{ message: string }> => {
      return this.requestJson('/auth/2fa/disable', {
        method: 'POST',
        auth: true,
        body: { code, password },
      });
    },
    register: async (payload: { name: string; email: string; password: string; phone?: string }): Promise<{ message: string }> => {
      return this.requestJson<{ message: string }>('/auth/register', {
        method: 'POST',
        body: payload,
      });
    },
    me: async (): Promise<AuthResponse> => {
      const response = await this.requestJson<AuthResponse>('/auth/me', {
        method: 'GET',
        auth: true,
      });
      return authResponseSchema.parse(response);
    },
    changePassword: async (payload: { currentPassword: string; newPassword: string }): Promise<{ message: string }> => {
      return this.requestJson<{ message: string }>('/auth/password/change', {
        method: 'POST',
        body: payload,
        auth: true,
      });
    },
    requestPasswordReset: async (payload: { email: string }): Promise<{ message: string }> => {
      return this.requestJson<{ message: string }>('/auth/password/reset/request', {
        method: 'POST',
        body: payload,
      });
    },
    confirmPasswordReset: async (payload: { email: string; code: string; newPassword: string }): Promise<{ message: string }> => {
      return this.requestJson<{ message: string }>('/auth/password/reset/confirm', {
        method: 'POST',
        body: payload,
      });
    },
    verifyEmail: async (token: string): Promise<{ message: string }> => {
      return this.requestJson<{ message: string }>('/auth/verify-email', {
        method: 'POST',
        body: { token },
      });
    },
    resendVerification: async (email: string): Promise<{ message: string }> => {
      return this.requestJson<{ message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: { email },
      });
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
    report: async (listingId: string, reason: string): Promise<{ message: string }> => {
      return this.requestJson<{ message: string }>(`/listings/${listingId}/report`, {
        method: 'POST',
        auth: true,
        body: { reason },
      });
    },
    bulkUpdateStatus: async (ids: string[], status: string): Promise<{ updated: number }> => {
      return this.requestJson<{ updated: number }>('/listings/bulk', {
        method: 'PATCH',
        auth: true,
        body: { ids, status },
      });
    },
    bulkDelete: async (ids: string[]): Promise<{ deleted: number }> => {
      return this.requestJson<{ deleted: number }>('/listings/bulk', {
        method: 'DELETE',
        auth: true,
        body: { ids },
      });
    },
  };

  readonly orders = {
    list: async (): Promise<SafeOrder[]> => {
      const response = await this.requestJson<SafeOrder[]>('/orders', { method: 'GET', auth: true });
      return response.map((order) => safeOrderSchema.parse(order));
    },
    listFiltered: async (params: { listingId?: string; status?: string }): Promise<SafeOrder[]> => {
      const qs = new URLSearchParams();
      if (params.listingId) qs.set('listingId', params.listingId);
      if (params.status) qs.set('status', params.status);
      const response = await this.requestJson<SafeOrder[]>(`/orders?${qs.toString()}`, { method: 'GET', auth: true });
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
    initiatePayment: async (orderId: string, options?: { callbackUrl?: string }): Promise<{
      provider: 'stripe' | 'paystack';
      clientSecret?: string;
      authorizationUrl?: string;
      reference?: string;
    }> => {
      return this.requestJson(`/orders/${orderId}/initiate-payment`, {
        method: 'POST',
        auth: true,
        body: options,
      });
    },
    verifyPaystackPayment: async (reference: string): Promise<{ verified: boolean; orderId: string }> => {
      return this.requestJson('/orders/payments/paystack/verify', {
        method: 'POST',
        auth: true,
        body: { reference },
      });
    },
    createShipment: async (
      orderId: string,
      payload: { carrier?: string; trackingNumber?: string; serviceLevel?: string; estimatedDelivery?: string },
    ) => {
      return this.requestJson<Record<string, unknown>>(`/orders/${orderId}/shipment`, {
        method: 'POST',
        auth: true,
        body: payload,
      });
    },
    updateShipment: async (
      orderId: string,
      payload: { carrier?: string; trackingNumber?: string; serviceLevel?: string; status?: string; estimatedDelivery?: string; deliveredAt?: string },
    ) => {
      return this.requestJson<Record<string, unknown>>(`/orders/${orderId}/shipment`, {
        method: 'PATCH',
        auth: true,
        body: payload,
      });
    },
    taxEstimate: async (payload: {
      cartItems: Array<{ amountCents: number; reference?: string; taxCode?: string }>;
      shippingAddress: {
        line1: string;
        line2?: string;
        city: string;
        state?: string;
        postalCode?: string;
        country: string;
      };
      currency?: string;
    }): Promise<{
      taxAmountCents: number;
      taxRate: number;
      taxJurisdiction: string;
      breakdown: Array<{ description: string; amountCents: number; rate: number; inclusive: boolean; country: string | null; taxType: string | null }>;
      available: boolean;
    }> => {
      return this.requestJson('/orders/tax-estimate', {
        method: 'POST',
        auth: true,
        body: payload,
      });
    },
    getReceipt: async (orderId: string): Promise<{
      orderId: string;
      orderNumber: string;
      currency: string;
      subtotalCents: number;
      taxAmountCents: number;
      taxRate: number | null;
      taxJurisdiction: string | null;
      totalCents: number;
      breakdown: unknown[];
    }> => {
      return this.requestJson(`/orders/${orderId}/receipt`, {
        method: 'GET',
        auth: true,
      });
    },
    purchaseLabel: async (orderId: string, rateId: string): Promise<PurchasedLabel> => {
      return this.requestJson<PurchasedLabel>(`/orders/${orderId}/label`, {
        method: 'POST',
        auth: true,
        body: { rateId },
      });
    },
  };

  readonly shipping = {
    getRates: async (
      fromAddress: ShippoAddress,
      toAddress: ShippoAddress,
      parcel: ShippoParcel,
    ): Promise<ShippingRate[]> => {
      return this.requestJson<ShippingRate[]>('/shipping/rates', {
        method: 'POST',
        auth: true,
        body: { fromAddress, toAddress, parcel },
      });
    },
  };

  readonly reviews = {
    forListing: async (listingId: string, viewerId?: string): Promise<ListingReviewResponse> => {
      const result = await this.request<ListingReviewResponse>(
        `/reviews${buildQuery({ listingId, ...(viewerId ? { viewerId } : {}) })}`,
        { method: 'GET' },
      );
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
    vote: async (reviewId: string): Promise<{ helpfulCount: number; userVoted: boolean }> => {
      return this.requestJson<{ helpfulCount: number; userVoted: boolean }>(`/reviews/${reviewId}/vote`, {
        method: 'POST',
        auth: true,
      });
    },
    flag: async (reviewId: string, reason: string): Promise<void> => {
      await this.requestJson<void>(`/reviews/${reviewId}/flag`, {
        method: 'POST',
        auth: true,
        body: { reason },
      });
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
    markThreadRead: async (id: string): Promise<void> => {
      await this.patch<void>(`/messages/threads/${id}/read`, undefined, { auth: true });
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
    unregisterDevice: async (pushToken: string): Promise<void> => {
      await this.requestJson<void>('/notifications/unregister-device', {
        method: 'DELETE',
        auth: true,
        body: { token: pushToken },
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
    listUsers: async (params: { search?: string; status?: string; role?: string; page?: number; limit?: number } = {}): Promise<AdminUserDetail[]> => {
      const q = new URLSearchParams();
      if (params.search) q.set('search', params.search);
      if (params.status) q.set('status', params.status);
      if (params.role) q.set('role', params.role);
      if (params.page != null) q.set('page', String(params.page));
      if (params.limit != null) q.set('limit', String(params.limit));
      const qs = q.toString() ? `?${q.toString()}` : '';
      const result = await this.request<AdminUserDetail[]>(`/admin/users${qs}`, { method: 'GET', auth: true });
      return result.map((u) => adminUserDetailSchema.parse(u));
    },
    suspendUser: async (id: string, reason: string, durationDays?: number | null): Promise<void> => {
      await this.requestJson<void>(`/admin/users/${id}/suspend`, {
        method: 'POST',
        auth: true,
        body: { reason, durationDays },
      });
    },
    unsuspendUser: async (id: string): Promise<void> => {
      await this.requestJson<void>(`/admin/users/${id}/unsuspend`, {
        method: 'POST',
        auth: true,
        body: {},
      });
    },
    banUser: async (id: string, reason: string): Promise<void> => {
      await this.requestJson<void>(`/admin/users/${id}/ban`, {
        method: 'POST',
        auth: true,
        body: { reason },
      });
    },
    getAnalytics: async (): Promise<{
      salesTrend: Array<{ label: string; value: number }>;
      userGrowth: Array<{ label: string; value: number }>;
      recentActivity: Array<{ title: string; meta: string; time: string; tone: string }>;
    }> => {
      return this.request('/admin/dashboard/analytics', { method: 'GET', auth: true });
    },
  };

  readonly auctions = {
    list: async (params: { page?: number; pageSize?: number; status?: string; sort?: string; keyword?: string; sellerId?: string } = {}): Promise<PaginatedResponse<Auction>> => {
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
    listAddresses: async () => {
      return this.request<any[]>('/users/me/addresses', { method: 'GET', auth: true });
    },
    createAddress: async (payload: any) => {
      return this.requestJson<any>('/users/me/addresses', { method: 'POST', auth: true, body: payload });
    },
    updateAddress: async (id: string, payload: any) => {
      return this.requestJson<any>(`/users/me/addresses/${id}`, { method: 'PATCH', auth: true, body: payload });
    },
    deleteAddress: async (id: string) => {
      await this.request<void>(`/users/me/addresses/${id}`, { method: 'DELETE', auth: true });
    },
    acceptTerms: async (): Promise<void> => {
      await this.request<void>('/users/me/accept-terms', { method: 'POST', auth: true });
    },
    exportData: async (): Promise<Record<string, unknown>> => {
      return this.request<Record<string, unknown>>('/users/me/export', { method: 'GET', auth: true });
    },
    becomeSeller: async (): Promise<SafeUser> => {
      const result = await this.requestJson<SafeUser>('/users/me/become-seller', { method: 'POST', auth: true });
      return safeUserSchema.parse(result);
    },
  };

  readonly legal = {
    acceptTos: async (version: string): Promise<void> => {
      await this.requestJson<void>('/legal/accept-tos', { method: 'POST', auth: true, body: { version } });
    },
    deleteAccount: async (): Promise<{ scheduledAt: string }> => {
      return this.requestJson<{ scheduledAt: string }>('/legal/delete-account', { method: 'POST', auth: true });
    },
    cancelDeletion: async (): Promise<void> => {
      await this.requestJson<void>('/legal/cancel-deletion', { method: 'POST', auth: true });
    },
    exportData: async (): Promise<Record<string, unknown>> => {
      return this.request<Record<string, unknown>>('/legal/data-export', { method: 'GET', auth: true });
    },
  };

  readonly inventory = {
    getByVariant: async (variantId: string): Promise<{
      variantId: string;
      items: Array<{ id: string; quantity: number; availableQuantity: number; reservedQuantity: number; damagedQuantity: number; location: string; metadata: any; createdAt: string }>;
      summary: { totalQuantity: number; availableQuantity: number; reservedQuantity: number; damagedQuantity: number };
    }> => {
      return this.request(`/inventory/variant/${variantId}`, { method: 'GET', auth: true });
    },
    addStock: async (variantId: string, payload: { quantity: number; location?: string; metadata?: any }) => {
      return this.requestJson(`/inventory/variant/${variantId}/add`, { method: 'POST', auth: true, body: payload });
    },
    adjustStock: async (variantId: string, payload: { adjustment: number; reason: string }) => {
      return this.requestJson(`/inventory/variant/${variantId}/adjust`, { method: 'POST', auth: true, body: payload });
    },
    markDamaged: async (itemId: string, payload: { quantity: number; reason?: string }) => {
      return this.requestJson(`/inventory/items/${itemId}/damage`, { method: 'POST', auth: true, body: payload });
    },
  };

  readonly payouts = {
    getBalance: async (): Promise<{
      availableCents: number;
      currency: string;
      nextPayoutDate: string | null;
      totalPaidCents: number;
      minimumPayoutCents: number;
      completedPayoutCount: number;
    }> => {
      return this.request('/payouts/balance', { method: 'GET', auth: true });
    },
    list: async (page = 1): Promise<{
      data: Array<{
        id: string;
        amountCents: number;
        currency: string;
        status: 'pending' | 'processing' | 'paid' | 'failed';
        transferId: string | null;
        notes: string | null;
        createdAt: string;
      }>;
      total: number;
      page: number;
      pageSize: number;
    }> => {
      return this.request(`/payouts?page=${page}`, { method: 'GET', auth: true });
    },
    getOnboardStatus: async (): Promise<{
      status: 'incomplete' | 'pending' | 'connected';
      onboardingUrl?: string;
    }> => {
      return this.request('/payouts/onboard', { method: 'GET', auth: true });
    },
    requestPayout: async (amountCents: number): Promise<{
      id: string;
      amountCents: number;
      currency: string;
      status: 'pending' | 'processing' | 'paid' | 'failed';
      transferId: string | null;
      notes: string | null;
      createdAt: string;
    }> => {
      return this.requestJson('/payouts/request', { method: 'POST', auth: true, body: { amountCents } });
    },
  };

  readonly fees = {
    preview: async (listingId: string, subtotalCents: number): Promise<FeePreview> => {
      return this.request<FeePreview>(`/fees/preview?listingId=${encodeURIComponent(listingId)}&subtotalCents=${subtotalCents}`, {
        method: 'GET',
        auth: true,
      });
    },
  };

  readonly adminFeeSchedules = {
    list: async (): Promise<FeeSchedule[]> => {
      return this.request<FeeSchedule[]>('/admin/fee-schedules', { method: 'GET', auth: true });
    },
    create: async (payload: CreateFeeScheduleDto): Promise<FeeSchedule> => {
      return this.requestJson<FeeSchedule>('/admin/fee-schedules', { method: 'POST', auth: true, body: payload });
    },
    update: async (id: string, payload: UpdateFeeScheduleDto): Promise<FeeSchedule> => {
      return this.requestJson<FeeSchedule>(`/admin/fee-schedules/${id}`, { method: 'PUT', auth: true, body: payload });
    },
    remove: async (id: string): Promise<void> => {
      await this.request<void>(`/admin/fee-schedules/${id}`, { method: 'DELETE', auth: true });
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
    getBySeller: async (userId: string): Promise<Storefront | null> => {
      try {
        const result = await this.requestJson<Storefront>(`/storefronts/seller/${userId}`, { method: 'GET' });
        return result ? storefrontSchema.parse(result) : null;
      } catch {
        return null;
      }
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

  readonly returns = {
    initiate: async (orderId: string, payload: InitiateReturnDto): Promise<SafeReturn> => {
      const result = await this.requestJson<SafeReturn>(`/orders/${orderId}/return`, {
        method: 'POST',
        auth: true,
        body: payload,
      });
      return safeReturnSchema.parse(result);
    },
    list: async (): Promise<SafeReturn[]> => {
      const result = await this.request<SafeReturn[]>('/returns', { method: 'GET', auth: true });
      return result.map((r) => safeReturnSchema.parse(r));
    },
    get: async (id: string): Promise<SafeReturn> => {
      const result = await this.request<SafeReturn>(`/returns/${id}`, { method: 'GET', auth: true });
      return safeReturnSchema.parse(result);
    },
    approve: async (id: string): Promise<SafeReturn> => {
      const result = await this.requestJson<SafeReturn>(`/returns/${id}/approve`, {
        method: 'PUT',
        auth: true,
      });
      return safeReturnSchema.parse(result);
    },
    reject: async (id: string, reason: string): Promise<SafeReturn> => {
      const result = await this.requestJson<SafeReturn>(`/returns/${id}/reject`, {
        method: 'PUT',
        auth: true,
        body: { reason },
      });
      return safeReturnSchema.parse(result);
    },
    confirmReceived: async (id: string): Promise<SafeReturn> => {
      const result = await this.requestJson<SafeReturn>(`/returns/${id}/received`, {
        method: 'PUT',
        auth: true,
      });
      return safeReturnSchema.parse(result);
    },
    forceRefund: async (id: string): Promise<SafeReturn> => {
      const result = await this.requestJson<SafeReturn>(`/admin/returns/${id}/force-refund`, {
        method: 'POST',
        auth: true,
      });
      return safeReturnSchema.parse(result);
    },
  };

  readonly cart = {
    get: () => this.request<unknown>('/cart', { method: 'GET', auth: true }),
    addItem: (listingId: string, quantity = 1, variantId?: string, variantLabel?: string) =>
      this.request<unknown>('/cart/items', { method: 'POST', auth: true, body: JSON.stringify({ listingId, quantity, variantId, variantLabel }) }),
    updateItem: (itemId: string, quantity: number) =>
      this.request<unknown>(`/cart/items/${itemId}`, { method: 'PUT', auth: true, body: JSON.stringify({ quantity }) }),
    removeItem: (itemId: string) =>
      this.request<void>(`/cart/items/${itemId}`, { method: 'DELETE', auth: true }),
    clear: () => this.request<void>('/cart', { method: 'DELETE', auth: true }),
  };

  readonly analytics = {
    getOverview: (period: '7d' | '30d' | '90d' = '30d') =>
      this.request<SellerAnalyticsOverview>(`/analytics/seller/overview?period=${period}`, { method: 'GET', auth: true }),

    getRevenue: (period: '7d' | '30d' | '90d' = '30d', groupBy: 'day' | 'week' | 'month' = 'day') =>
      this.request<SellerRevenuePoint[]>(
        `/analytics/seller/revenue?period=${period}&groupBy=${groupBy}`,
        { method: 'GET', auth: true },
      ),

    getTopListings: (limit = 5) =>
      this.request<SellerTopListing[]>(`/analytics/seller/top-listings?limit=${limit}`, { method: 'GET', auth: true }),

    getReviewsSummary: () =>
      this.request<SellerReviewsSummary>('/analytics/seller/reviews-summary', { method: 'GET', auth: true }),
  };
}

export interface SellerAnalyticsOverview {
  gmv: number;
  orders: number;
  avgOrderValue: number;
  conversionRate: number;
  pageViews: number;
  uniqueVisitors: number;
  changes: {
    gmvChange: number;
    ordersChange: number;
    aovChange: number;
  };
}

export interface SellerRevenuePoint {
  date: string;
  revenue: number;
  orders: number;
  fees: number;
}

export interface SellerTopListing {
  listingId: string;
  title: string;
  thumbnailUrl: string | null;
  views: number;
  orders: number;
  revenue: number;
  conversionRate: number;
}

export interface SellerReviewsSummary {
  avgRating: number;
  totalReviews: number;
  ratingDistribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
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
