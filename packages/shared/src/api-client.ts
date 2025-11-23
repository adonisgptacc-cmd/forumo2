import {
  AuthResponse,
  CreateListingDto,
  UpdateListingDto,
  CreateOrderDto,
  CreateThreadDto,
  ListingImage,
  ListingSearchParams,
  ListingSearchResponse,
  ListingReviewResponse,
  AdminDisputeSummary,
  AdminKycSubmission,
  AdminListingModeration,
  CreateReviewDto,
  SafeListing,
  SafeMessageThread,
  SafeOrder,
  SafeReview,
  SendMessageDto,
  UpdateOrderStatusDto,
  ReviewRollup,
  createReviewSchema,
  listingSearchParamsSchema,
  listingSearchResponseSchema,
  safeListingSchema,
  listingReviewResponseSchema,
  adminDisputeSchema,
  adminKycSubmissionSchema,
  adminListingModerationSchema,
  messageThreadSchema,
  safeOrderSchema,
  reviewSchema,
  reviewRollupSchema,
  authResponseSchema,
} from './types';

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
    const url = new URL(path, `${this.baseUrl}/`);
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

  private async requestJson<T>(path: string, options: RequestInit & { auth?: boolean; body?: unknown } = {}): Promise<T> {
    const body =
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body;
    return this.request<T>(path, { ...options, body });
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
    listThreads: async (params: { userId?: string; listingId?: string } = {}): Promise<SafeMessageThread[]> => {
      const result = await this.request<SafeMessageThread[]>(
        `/messages/threads${buildQuery(params)}`,
        { method: 'GET', auth: true },
      );
      return result.map((thread) => messageThreadSchema.parse(thread));
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
          body: formData,
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
  };

  readonly admin = {
    listKycSubmissions: async (): Promise<AdminKycSubmission[]> => {
      const result = await this.request<AdminKycSubmission[]>('/admin/kyc/submissions', {
        method: 'GET',
        auth: true,
      });
      return result.map((item) => adminKycSubmissionSchema.parse(item));
    },
    listListingsForReview: async (): Promise<AdminListingModeration[]> => {
      const result = await this.request<AdminListingModeration[]>('/admin/moderations/listings', {
        method: 'GET',
        auth: true,
      });
      return result.map((item) => adminListingModerationSchema.parse(item));
    },
    listDisputes: async (): Promise<AdminDisputeSummary[]> => {
      const result = await this.request<AdminDisputeSummary[]>('/admin/disputes', { method: 'GET', auth: true });
      return result.map((item) => adminDisputeSchema.parse(item));
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
