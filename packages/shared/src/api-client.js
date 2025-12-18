"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForumoApiClient = exports.ApiError = void 0;
const types_1 = require("./types");
class ApiError extends Error {
    status;
    details;
    constructor(message, status, details) {
        super(message);
        this.status = status;
        this.details = details;
        this.name = 'ApiError';
    }
}
exports.ApiError = ApiError;
class ForumoApiClient {
    baseUrl;
    fetchImpl;
    getAccessToken;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/$/, '');
        this.fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
        if (!this.fetchImpl) {
            throw new Error('Fetch implementation not available');
        }
        this.getAccessToken = options.getAccessToken;
    }
    buildUrl(path, query) {
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
    async request(path, init = {}) {
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
        return payload;
    }
    async requestJson(path, options = {}) {
        const body = options.body && !(options.body instanceof FormData)
            ? JSON.stringify(options.body)
            : options.body;
        return this.request(path, { ...options, body });
    }
    auth = {
        login: async (payload) => {
            const response = await this.requestJson('/auth/login', {
                method: 'POST',
                body: payload,
            });
            return types_1.authResponseSchema.parse(response);
        },
        register: async (payload) => {
            const response = await this.requestJson('/auth/register', {
                method: 'POST',
                body: payload,
            });
            return types_1.authResponseSchema.parse(response);
        },
        me: async () => {
            const response = await this.requestJson('/auth/me', {
                method: 'GET',
                auth: true,
            });
            return types_1.authResponseSchema.parse(response);
        },
    };
    listings = {
        search: async (params = {}) => {
            const parsed = types_1.listingSearchParamsSchema.parse({
                page: Number(params.page ?? 1),
                pageSize: Number(params.pageSize ?? 12),
                keyword: params.keyword,
                sellerId: params.sellerId,
                status: params.status,
                minPriceCents: params.minPriceCents !== undefined ? Number(params.minPriceCents) : undefined,
                maxPriceCents: params.maxPriceCents !== undefined ? Number(params.maxPriceCents) : undefined,
                tags: params.tags,
            });
            const result = await this.request(`/listings/search${buildQuery(parsed)}`, {
                method: 'GET',
            });
            return types_1.listingSearchResponseSchema.parse(result);
        },
        get: async (id) => {
            const result = await this.requestJson(`/listings/${id}`, { method: 'GET' });
            return types_1.safeListingSchema.parse(result);
        },
        create: async (payload) => {
            const result = await this.requestJson('/listings', {
                method: 'POST',
                auth: true,
                body: payload,
            });
            return types_1.safeListingSchema.parse(result);
        },
        update: async (id, payload) => {
            const result = await this.requestJson(`/listings/${id}`, {
                method: 'PATCH',
                auth: true,
                body: payload,
            });
            return types_1.safeListingSchema.parse(result);
        },
        uploadImage: async (listingId, file) => {
            const formData = new FormData();
            formData.append('file', file);
            return this.request(`/listings/${listingId}/images`, {
                method: 'POST',
                auth: true,
                body: formData,
            });
        },
    };
    orders = {
        list: async () => {
            const response = await this.requestJson('/orders', { method: 'GET', auth: true });
            return response.map((order) => types_1.safeOrderSchema.parse(order));
        },
        get: async (id) => {
            const response = await this.requestJson(`/orders/${id}`, { method: 'GET', auth: true });
            return types_1.safeOrderSchema.parse(response);
        },
        create: async (payload) => {
            const response = await this.requestJson('/orders', {
                method: 'POST',
                auth: true,
                body: payload,
            });
            return types_1.safeOrderSchema.parse(response);
        },
        updateStatus: async (id, payload) => {
            const response = await this.requestJson(`/orders/${id}/status`, {
                method: 'PATCH',
                auth: true,
                body: payload,
            });
            return types_1.safeOrderSchema.parse(response);
        },
    };
    reviews = {
        forListing: async (listingId) => {
            const result = await this.request(`/reviews${buildQuery({ listingId })}`, {
                method: 'GET',
            });
            return types_1.listingReviewResponseSchema.parse(result);
        },
        create: async (payload) => {
            const parsed = types_1.createReviewSchema.parse(payload);
            const result = await this.requestJson('/reviews', {
                method: 'POST',
                auth: true,
                body: parsed,
            });
            return types_1.reviewSchema.parse(result);
        },
        rollup: async (sellerId) => {
            const result = await this.request(`/reviews/seller/${sellerId}/rollup`, { method: 'GET' });
            return types_1.reviewRollupSchema.parse(result);
        },
    };
    messaging = {
        listThreads: async (params = {}) => {
            const result = await this.request(`/messages/threads${buildQuery(params)}`, { method: 'GET', auth: true });
            return {
                ...result,
                data: result.data.map((thread) => types_1.messageThreadSchema.parse(thread)),
            };
        },
        getThread: async (id) => {
            const result = await this.request(`/messages/threads/${id}`, {
                method: 'GET',
                auth: true,
            });
            return types_1.messageThreadSchema.parse(result);
        },
        createThread: async (payload) => {
            const result = await this.requestJson('/messages/threads', {
                method: 'POST',
                auth: true,
                body: payload,
            });
            return types_1.messageThreadSchema.parse(result);
        },
        sendMessage: async (threadId, payload, attachments) => {
            if (attachments?.length) {
                const formData = new FormData();
                formData.append('authorId', payload.authorId);
                formData.append('body', payload.body);
                if (payload.metadata) {
                    formData.append('metadata', JSON.stringify(payload.metadata));
                }
                attachments.forEach((file) => formData.append('attachments', file));
                const result = await this.request(`/messages/threads/${threadId}/messages`, {
                    method: 'POST',
                    auth: true,
                    body: formData,
                });
                return types_1.messageThreadSchema.parse(result);
            }
            const result = await this.requestJson(`/messages/threads/${threadId}/messages`, {
                method: 'POST',
                auth: true,
                body: payload,
            });
            return types_1.messageThreadSchema.parse(result);
        },
    };
    notifications = {
        registerExpoPushToken: async (token) => {
            await this.requestJson('/notifications/expo-token', {
                method: 'POST',
                auth: true,
                body: { token },
            });
        },
    };
    admin = {
        listKycSubmissions: async () => {
            const result = await this.request('/admin/kyc/submissions', {
                method: 'GET',
                auth: true,
            });
            return result.map((item) => types_1.adminKycSubmissionSchema.parse(item));
        },
        reviewKycSubmission: async (id, payload) => {
            const result = await this.requestJson(`/admin/kyc/submissions/${id}`, {
                method: 'PATCH',
                auth: true,
                body: payload,
            });
            return types_1.adminKycSubmissionSchema.parse(result);
        },
        listListingsForReview: async () => {
            const result = await this.request('/admin/moderations/listings', {
                method: 'GET',
                auth: true,
            });
            return result.map((item) => types_1.adminListingModerationSchema.parse(item));
        },
        reviewListing: async (id, payload) => {
            const result = await this.requestJson(`/admin/moderations/listings/${id}`, {
                method: 'PATCH',
                auth: true,
                body: payload,
            });
            return types_1.adminListingModerationSchema.parse(result);
        },
        listDisputes: async () => {
            const result = await this.request('/admin/disputes', { method: 'GET', auth: true });
            return result.map((item) => types_1.adminDisputeSchema.parse(item));
        },
        resolveDispute: async (id, payload) => {
            const result = await this.requestJson(`/admin/disputes/${id}`, {
                method: 'PATCH',
                auth: true,
                body: payload,
            });
            return types_1.adminDisputeSchema.parse(result);
        },
    };
}
exports.ForumoApiClient = ForumoApiClient;
function buildQuery(params) {
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
function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    }
    catch (error) {
        return text;
    }
}
