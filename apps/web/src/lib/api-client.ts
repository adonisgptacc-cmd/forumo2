import type {
  AuthResponse,
  CreateListingDto,
  CreateOrderDto,
  ListingImage,
  ListingSearchParams,
  ListingSearchResponse,
  AdminDisputeSummary,
  AdminKycSubmission,
  AdminListingModeration,
  Message,
  SafeListing,
  SafeMessageThread,
  SafeOrder,
  SendMessageDto,
  UpdateListingDto,
} from '@forumo/shared';
import { ForumoApiClient } from '@forumo/shared';

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
const useMocks = process.env.NEXT_PUBLIC_USE_API_MOCKS === 'true';

export function createApiClient(accessToken?: string | null) {
  if (useMocks) {
    return new MockApiClient();
  }
  return new ForumoApiClient({
    baseUrl: apiBaseUrl,
    getAccessToken: () => accessToken ?? undefined,
  });
}

type MockState = {
  listings: SafeListing[];
  orders: SafeOrder[];
  threads: SafeMessageThread[];
  kycSubmissions: AdminKycSubmission[];
  moderationQueue: AdminListingModeration[];
  disputes: AdminDisputeSummary[];
};

const globalKey = '__forumoMockState';
const storageKey = '__forumoMockStateStorage';

function loadMockStateFromStorage(): MockState | null {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as MockState;
  } catch {
    return null;
  }
}

function persistMockState(state: MockState) {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Ignore storage write errors (e.g., Safari private mode)
  }
}

function getMockState(): MockState {
  const existing = (globalThis as any)[globalKey];
  if (existing) {
    return existing as MockState;
  }
  const stored = loadMockStateFromStorage();
  if (stored) {
    (globalThis as any)[globalKey] = stored;
    return stored;
  }
  const now = new Date().toISOString();
  const sampleListing: SafeListing = {
    id: 'listing-sample',
    sellerId: 'seller-sample',
    title: 'Hand-carved stool',
    description: 'Crafted from reclaimed iroko wood with shea butter finish.',
    priceCents: 4800,
    currency: 'USD',
    status: 'PUBLISHED',
    moderationStatus: 'APPROVED',
    location: 'Accra',
    metadata: null,
    createdAt: now,
    updatedAt: now,
    variants: [],
    images: [],
  };
  const sampleOrder: SafeOrder = {
    id: 'order-sample',
    orderNumber: 'F-1001',
    buyerId: 'buyer-sample',
    sellerId: 'seller-sample',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    totalItemCents: 4800,
    shippingCents: 1200,
    feeCents: 300,
    currency: 'USD',
    metadata: null,
    placedAt: now,
    timeline: [
      { id: 'timeline-1', orderId: 'order-sample', status: 'PENDING', note: null, createdAt: now },
    ],
    items: [
      {
        id: 'order-item-1',
        listingId: sampleListing.id,
        listingTitle: sampleListing.title,
        variantId: null,
        variantLabel: null,
        quantity: 1,
        unitPriceCents: 4800,
        currency: 'USD',
        metadata: null,
      },
    ],
    shipments: [],
    escrow: {
      id: 'escrow-1',
      status: 'HOLDING',
      amountCents: 6000,
      currency: 'USD',
      releaseDate: null,
    },
    payments: [],
  } as SafeOrder;
  const sampleThread: SafeMessageThread = {
    id: 'thread-sample',
    listingId: sampleListing.id,
    subject: 'Pickup logistics',
    metadata: null,
    createdAt: now,
    participants: [
      { id: 'tp1', threadId: 'thread-sample', userId: 'buyer-sample', role: 'BUYER' },
      { id: 'tp2', threadId: 'thread-sample', userId: 'seller-sample', role: 'SELLER' },
    ],
    messages: [
      {
        id: 'msg-1',
        threadId: 'thread-sample',
        authorId: 'buyer-sample',
        body: 'Can you deliver on Saturday?',
        status: 'SENT',
        moderationStatus: 'APPROVED',
        moderationNotes: null,
        metadata: null,
        createdAt: now,
        attachments: [],
        receipts: [],
      },
    ],
  };
  const state: MockState = {
    listings: [sampleListing],
    orders: [sampleOrder],
    threads: [sampleThread],
    kycSubmissions: [
      {
        id: 'kyc-1',
        userId: 'seller-sample',
        reviewerId: null,
        status: 'PENDING',
        rejectionReason: null,
        submittedAt: now,
        reviewedAt: null,
        documents: [
          {
            id: 'kyc-doc-1',
            submissionId: 'kyc-1',
            type: 'passport',
            status: 'PENDING',
            url: null,
            createdAt: now,
            metadata: { issuingCountry: 'GH' },
          },
        ],
        user: { id: 'seller-sample', email: 'seller@example.com', name: 'Mock Seller' },
        reviewer: null,
      },
    ],
    moderationQueue: [
      {
        id: sampleListing.id,
        sellerId: sampleListing.sellerId,
        title: sampleListing.title,
        status: sampleListing.status,
        moderationStatus: 'PENDING',
        moderationNotes: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    disputes: [
      {
        id: 'dispute-1',
        escrowId: 'escrow-1',
        orderId: sampleOrder.id,
        orderNumber: sampleOrder.orderNumber,
        status: 'OPEN',
        reason: 'Item arrived damaged',
        resolution: null,
        openedBy: { id: 'buyer-sample', email: 'buyer@example.com', name: 'Buyer' },
        openedAt: now,
        resolvedAt: null,
        amountCents: sampleOrder.totalItemCents,
        currency: sampleOrder.currency,
        messageCount: 2,
      },
    ],
  };
  (globalThis as any)[globalKey] = state;
  persistMockState(state);
  return state;
}

class MockApiClient {
  private get state() {
    return getMockState();
  }

  auth = {
    login: async (payload: { email: string; password: string }): Promise<AuthResponse> => {
      const role = payload.email.includes('admin')
        ? 'ADMIN'
        : payload.email.includes('moderator')
          ? 'MODERATOR'
          : 'SELLER';
      return {
        accessToken: 'mock-token',
        user: {
          id: 'mock-user',
          email: payload.email,
          name: 'Mock Seller',
          role,
        },
      };
    },
    register: async (payload: { name: string; email: string; password: string; phone?: string }): Promise<AuthResponse> => {
      return {
        accessToken: 'mock-token',
        user: {
          id: 'mock-user',
          email: payload.email,
          name: payload.name,
          role: 'SELLER',
        },
      };
    },
    me: async () => ({
      accessToken: 'mock-token',
      user: { id: 'mock-user', email: 'mock@example.com', name: 'Mock Seller', role: 'SELLER' },
    }),
  };

  listings = {
    search: async (params: Partial<ListingSearchParams>): Promise<ListingSearchResponse> => {
      const list = this.state.listings.filter((listing) => {
        const keyword = params.keyword?.toLowerCase();
        const status = params.status;
        const sellerId = params.sellerId;
        const minPrice = params.minPriceCents ?? 0;
        const maxPrice = params.maxPriceCents;
        const tags = params.tags?.map((tag) => tag.toLowerCase());
        return (
          (!keyword || listing.title.toLowerCase().includes(keyword) || listing.description.toLowerCase().includes(keyword)) &&
          (!status || listing.status === status) &&
          (!sellerId || listing.sellerId === sellerId) &&
          (!maxPrice || listing.priceCents <= maxPrice) &&
          listing.priceCents >= minPrice &&
          (!tags?.length || tags.some((tag) => listing.metadata?.tags?.includes(tag)))
        );
      });
      return {
        data: list,
        total: list.length,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? list.length,
        pageCount: 1,
      };
    },
    get: async (id: string): Promise<SafeListing> => {
      const listing = this.state.listings.find((item) => item.id === id);
      if (!listing) throw new Error('Listing not found');
      return listing;
    },
    create: async (payload: CreateListingDto): Promise<SafeListing> => {
      const listing: SafeListing = {
        ...payload,
        id: uid(),
        currency: payload.currency ?? 'USD',
        status: payload.status ?? 'PUBLISHED',
        moderationStatus: 'APPROVED',
        location: payload.location,
        metadata: payload.metadata ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        images: [],
        variants: payload.variants ?? [],
      } as SafeListing;
      this.state.listings.unshift(listing);
      persistMockState(this.state);
      return listing;
    },
    update: async (id: string, payload: UpdateListingDto): Promise<SafeListing> => {
      const listing = await this.listings.get(id);
      Object.assign(listing, payload, { updatedAt: new Date().toISOString() });
      persistMockState(this.state);
      return listing;
    },
    uploadImage: async (listingId: string, file: Blob): Promise<ListingImage> => {
      const listing = await this.listings.get(listingId);
      const image: ListingImage = {
        id: uid(),
        bucket: 'mock',
        storageKey: 'mock',
        url: typeof window !== 'undefined' ? URL.createObjectURL(file) : 'https://placehold.co/600x400',
        mimeType: 'image/jpeg',
        fileSize: file.size ?? 0,
        width: null,
        height: null,
        position: listing.images.length,
        createdAt: new Date().toISOString(),
      } as ListingImage;
      listing.images.push(image);
      persistMockState(this.state);
      return image;
    },
  };

  orders = {
    list: async (): Promise<SafeOrder[]> => {
      return this.state.orders;
    },
    get: async (id: string): Promise<SafeOrder> => {
      const order = this.state.orders.find((item) => item.id === id);
      if (!order) throw new Error('Order not found');
      return order;
    },
    create: async (payload: CreateOrderDto): Promise<SafeOrder> => {
      const listing = await this.listings.get(payload.items[0].listingId);
      const id = uid();
      const now = new Date().toISOString();
      const order: SafeOrder = {
        id,
        orderNumber: `F-${Math.floor(Math.random() * 10000)}`,
        buyerId: payload.buyerId,
        sellerId: payload.sellerId,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        totalItemCents: listing.priceCents * (payload.items[0].quantity ?? 1),
        shippingCents: payload.shippingCents ?? 0,
        feeCents: payload.feeCents ?? 0,
        currency: payload.currency ?? listing.currency ?? 'USD',
        metadata: payload.metadata ?? null,
        placedAt: now,
        timeline: [{ id: uid(), orderId: id, status: 'PENDING', note: null, createdAt: now }],
        items: [
          {
            id: uid(),
            listingId: listing.id,
            listingTitle: listing.title,
            variantId: payload.items[0].variantId ?? null,
            variantLabel: listing.variants.find((variant) => variant.id === payload.items[0].variantId)?.label ?? null,
            quantity: payload.items[0].quantity ?? 1,
            unitPriceCents: listing.priceCents,
            currency: listing.currency ?? 'USD',
            metadata: null,
          },
        ],
        shipments: [],
        escrow: {
          id: uid(),
          status: 'HOLDING',
          amountCents: listing.priceCents,
          currency: listing.currency ?? 'USD',
          releaseDate: null,
        },
        payments: [],
      } as SafeOrder;
      this.state.orders.unshift(order);
      persistMockState(this.state);
      return order;
    },
    updateStatus: async (id: string, payload: { status: string }): Promise<SafeOrder> => {
      const order = await this.orders.get(id);
      order.status = payload.status as SafeOrder['status'];
      order.timeline.push({ id: uid(), orderId: id, status: payload.status as SafeOrder['status'], note: null, createdAt: new Date().toISOString() });
      persistMockState(this.state);
      return order;
    },
  };

  messaging = {
    listThreads: async (): Promise<any> => {
      return {
        data: this.state.threads,
        total: this.state.threads.length,
        page: 1,
        pageSize: this.state.threads.length,
        pageCount: 1,
      };
    },
    getThread: async (id: string): Promise<SafeMessageThread> => {
      const thread = this.state.threads.find((item) => item.id === id);
      if (!thread) throw new Error('Thread not found');
      return thread;
    },
    createThread: async (): Promise<SafeMessageThread> => {
      const thread = await this.messaging.getThread('thread-sample');
      return thread;
    },
    sendMessage: async (threadId: string, payload: SendMessageDto, attachments?: Blob[]): Promise<SafeMessageThread> => {
      const thread = await this.messaging.getThread(threadId);
      const message: Message = {
        id: uid(),
        threadId,
        authorId: payload.authorId,
        body: payload.body,
        status: 'SENT',
        moderationStatus: payload.body.includes('bad') ? 'FLAGGED' : 'APPROVED',
        moderationNotes: null,
        metadata: payload.metadata ?? null,
        createdAt: new Date().toISOString(),
        attachments:
          attachments?.map((file) => ({
            id: uid(),
            url: typeof window !== 'undefined' ? URL.createObjectURL(file) : 'https://placehold.co/400',
            fileName: 'upload.jpg',
            mimeType: 'image/jpeg',
            fileSize: file.size ?? 0,
            metadata: null,
          })) ?? [],
        receipts: [],
      };
      thread.messages.push(message);
      persistMockState(this.state);
      return thread;
    },
  };

  reviews = {
    forListing: async (_listingId: string): Promise<any> => {
      // Mock empty reviews for now
      return {
        rating: 0,
        count: 0,
        breakdown: {},
        recent: [],
      };
    },
    create: async (_payload: any): Promise<any> => {
      // Mock creation
      return {
        id: 'mock-review',
        rating: 5,
        text: 'Review content',
      };
    },
  };

  admin = {
    listKycSubmissions: async (): Promise<AdminKycSubmission[]> => {
      return this.state.kycSubmissions;
    },
    reviewKycSubmission: async (
      id: string,
      payload: { status: AdminKycSubmission['status']; rejectionReason?: string | null },
    ): Promise<AdminKycSubmission> => {
      const submission = this.state.kycSubmissions.find((item) => item.id === id);
      if (!submission) throw new Error('Submission not found');
      submission.status = payload.status;
      submission.rejectionReason = payload.rejectionReason ?? null;
      submission.reviewedAt = new Date().toISOString();
      submission.reviewer = {
        id: submission.reviewer?.id ?? 'reviewer-mock',
        email: submission.reviewer?.email ?? 'admin@example.com',
        name: submission.reviewer?.name ?? 'Console Reviewer',
      };
      persistMockState(this.state);
      return submission;
    },
    listListingsForReview: async (): Promise<AdminListingModeration[]> => {
      return this.state.moderationQueue;
    },
    reviewListing: async (
      id: string,
      payload: { moderationStatus: AdminListingModeration['moderationStatus']; moderationNotes?: string | null },
    ): Promise<AdminListingModeration> => {
      const listing = this.state.moderationQueue.find((item) => item.id === id);
      if (!listing) throw new Error('Listing not found');
      listing.moderationStatus = payload.moderationStatus;
      listing.moderationNotes = payload.moderationNotes ?? null;
      listing.updatedAt = new Date().toISOString();
      persistMockState(this.state);
      return listing;
    },
    listDisputes: async (): Promise<AdminDisputeSummary[]> => {
      return this.state.disputes;
    },
    resolveDispute: async (
      id: string,
      payload: { status: AdminDisputeSummary['status']; resolution?: string | null },
    ): Promise<AdminDisputeSummary> => {
      const dispute = this.state.disputes.find((item) => item.id === id);
      if (!dispute) throw new Error('Dispute not found');
      dispute.status = payload.status;
      dispute.resolution = payload.resolution ?? null;
      dispute.resolvedAt = new Date().toISOString();
      persistMockState(this.state);
      return dispute;
    },
  };
}

function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
