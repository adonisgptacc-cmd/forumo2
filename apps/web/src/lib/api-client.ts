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
  SafeReview,
  CreateReviewDto,
  ReviewRollup,
  ListingReviewResponse,
  Storefront,
  Auction,
  CreateAuctionDto,
  PlaceBidDto,
  CreateStorefrontDto,
} from "@forumo/shared";
import { ForumoApiClient } from "@forumo/shared";

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
const useMocks =
  process.env.NEXT_PUBLIC_USE_API_MOCKS === "true" &&
  process.env.NODE_ENV !== "production";

export function createApiClient(accessToken?: string | null): ForumoApiClient {
  if (useMocks) {
    return new MockApiClient(accessToken) as any as ForumoApiClient;
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
  addresses?: MockAddress[];
  kycSubmissions: AdminKycSubmission[];
  moderationQueue: AdminListingModeration[];
  disputes: AdminDisputeSummary[];
};

type MockAddress = {
  id: string;
  label?: string;
  fullName: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  type: string;
  isDefault: boolean;
};

type MockIdentity = {
  email: string;
  name: string;
  role: string;
};

const defaultMockIdentity: MockIdentity = {
  email: "mock@example.com",
  name: "Mock Seller",
  role: "SELLER",
};
const mockTosVersion = process.env.NEXT_PUBLIC_TOS_VERSION ?? "2024-01-01";
const mockAcceptedTerms = {
  termsAcceptedAt: "2024-01-01T00:00:00.000Z",
  tosVersion: mockTosVersion,
};

function createMockToken(identity: MockIdentity) {
  return ["mock-token", identity.role, identity.email, identity.name]
    .map(encodeURIComponent)
    .join(":");
}

function readMockToken(token?: string | null): MockIdentity {
  const [prefix, role, email, name] =
    token?.split(":").map(decodeURIComponent) ?? [];
  if (prefix !== "mock-token" || !role || !email || !name) {
    return defaultMockIdentity;
  }
  return { role, email, name };
}

const globalKey = "__forumoMockState";
const storageKey = "__forumoMockStateStorage";

function loadMockStateFromStorage(): MockState | null {
  if (typeof window === "undefined" || !window.sessionStorage) {
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
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Ignore storage write errors (e.g., Safari private mode)
  }
}

function setMockState(state: MockState) {
  (globalThis as any)[globalKey] = state;
  persistMockState(state);
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
    id: "listing-sample",
    sellerId: "seller-sample",
    title: "Hand-carved stool",
    description: "Crafted from reclaimed iroko wood with shea butter finish.",
    priceCents: 4800,
    currency: "USD",
    status: "PUBLISHED",
    moderationStatus: "APPROVED",
    location: "Accra",
    metadata: null,
    createdAt: now,
    updatedAt: now,
    variants: [],
    images: [],
  };
  const sampleOrder: SafeOrder = {
    id: "order-sample",
    orderNumber: "F-1001",
    buyerId: "buyer-sample",
    sellerId: "seller-sample",
    status: "PENDING",
    paymentStatus: "PENDING",
    totalItemCents: 4800,
    shippingCents: 1200,
    feeCents: 300,
    feePercent: 0,
    currency: "USD",
    metadata: null,
    placedAt: now,
    timeline: [
      {
        id: "timeline-1",
        orderId: "order-sample",
        status: "PENDING",
        note: null,
        createdAt: now,
      },
    ],
    items: [
      {
        id: "order-item-1",
        listingId: sampleListing.id,
        listingTitle: sampleListing.title,
        variantId: null,
        variantLabel: null,
        quantity: 1,
        unitPriceCents: 4800,
        currency: "USD",
        metadata: null,
      },
    ],
    shipments: [],
    escrow: {
      id: "escrow-1",
      status: "HOLDING",
      amountCents: 6000,
      currency: "USD",
      releaseDate: null,
    },
    payments: [],
  } as SafeOrder;
  const sampleThread: SafeMessageThread = {
    id: "thread-sample",
    listingId: sampleListing.id,
    subject: "Pickup logistics",
    metadata: null,
    createdAt: now,
    participants: [
      {
        id: "tp1",
        threadId: "thread-sample",
        userId: "buyer-sample",
        role: "BUYER",
      },
      {
        id: "tp2",
        threadId: "thread-sample",
        userId: "seller-sample",
        role: "SELLER",
      },
    ],
    messages: [
      {
        id: "msg-1",
        threadId: "thread-sample",
        authorId: "buyer-sample",
        body: "Can you deliver on Saturday?",
        status: "SENT",
        moderationStatus: "APPROVED",
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
        id: "kyc-1",
        userId: "seller-sample",
        reviewerId: null,
        status: "PENDING",
        rejectionReason: null,
        submittedAt: now,
        reviewedAt: null,
        documents: [
          {
            id: "kyc-doc-1",
            submissionId: "kyc-1",
            type: "passport",
            status: "PENDING",
            url: null,
            createdAt: now,
            metadata: { issuingCountry: "GH" },
          },
        ],
        user: {
          id: "seller-sample",
          email: "seller@example.com",
          name: "Mock Seller",
        },
        reviewer: null,
      },
    ],
    moderationQueue: [
      {
        id: sampleListing.id,
        sellerId: sampleListing.sellerId,
        title: sampleListing.title,
        status: sampleListing.status,
        moderationStatus: "PENDING",
        moderationNotes: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    disputes: [
      {
        id: "dispute-1",
        escrowId: "escrow-1",
        orderId: sampleOrder.id,
        orderNumber: sampleOrder.orderNumber,
        status: "OPEN",
        reason: "Item arrived damaged",
        resolution: null,
        openedBy: {
          id: "buyer-sample",
          email: "buyer@example.com",
          name: "Buyer",
        },
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
  constructor(private readonly accessToken?: string | null) {}

  private get state() {
    return getMockState();
  }

  async get(path: string) {
    console.log("Mock GET:", path);
    return {} as any;
  }

  async post(path: string, body: any) {
    console.log("Mock POST:", path, body);
    return {} as any;
  }

  async put(path: string, body: any) {
    console.log("Mock PUT:", path, body);
    return {} as any;
  }

  async patch(path: string, body: any) {
    console.log("Mock PATCH:", path, body);
    return {} as any;
  }

  async delete(path: string) {
    console.log("Mock DELETE:", path);
    return {} as any;
  }

  users = {
    listAddresses: async (): Promise<MockAddress[]> =>
      this.state.addresses ?? [],
    createAddress: async (
      payload: Omit<MockAddress, "id">,
    ): Promise<MockAddress> => {
      const address = { ...payload, id: uid() };
      const currentAddresses = this.state.addresses ?? [];
      const addresses = payload.isDefault
        ? [
            ...currentAddresses.map((item) => ({ ...item, isDefault: false })),
            address,
          ]
        : [...currentAddresses, address];
      setMockState({ ...this.state, addresses });
      return address;
    },
    updateAddress: async (
      id: string,
      payload: Partial<Omit<MockAddress, "id">>,
    ): Promise<MockAddress> => {
      const current = (this.state.addresses ?? []).find(
        (item) => item.id === id,
      );
      if (!current) throw new Error("Address not found");
      const updated = { ...current, ...payload, id };
      const addresses = (this.state.addresses ?? []).map((item) =>
        item.id === id
          ? updated
          : payload.isDefault
            ? { ...item, isDefault: false }
            : item,
      );
      setMockState({ ...this.state, addresses });
      return updated;
    },
    deleteAddress: async (id: string): Promise<void> => {
      const addresses = (this.state.addresses ?? []).filter(
        (item) => item.id !== id,
      );
      setMockState({ ...this.state, addresses });
    },
  };

  auth = {
    login: async (payload: {
      email: string;
      password: string;
    }): Promise<AuthResponse> => {
      const role = payload.email.includes("admin")
        ? "ADMIN"
        : payload.email.includes("moderator")
          ? "MODERATOR"
          : "SELLER";
      const identity = {
        email: payload.email,
        name: role === "ADMIN" ? "Mock Administrator" : "Mock Seller",
        role,
      };
      return {
        accessToken: createMockToken(identity),
        user: {
          id: "mock-user",
          ...identity,
          ...mockAcceptedTerms,
        },
      };
    },
    register: async (payload: {
      name: string;
      email: string;
      password: string;
      phone?: string;
    }): Promise<AuthResponse> => {
      const identity = {
        email: payload.email,
        name: payload.name,
        role: "SELLER",
      };
      return {
        accessToken: createMockToken(identity),
        user: {
          id: "mock-user",
          ...identity,
          ...mockAcceptedTerms,
        },
      };
    },
    me: async () => {
      const identity = readMockToken(this.accessToken);
      return {
        accessToken: this.accessToken ?? createMockToken(identity),
        user: { id: "mock-user", ...identity, ...mockAcceptedTerms },
      };
    },
  };

  listings = {
    search: async (
      params: Partial<ListingSearchParams>,
    ): Promise<ListingSearchResponse> => {
      const list = this.state.listings.filter((listing) => {
        const keyword = params.keyword?.toLowerCase();
        const status = params.status;
        const sellerId = params.sellerId;
        const minPrice = params.minPriceCents ?? 0;
        const maxPrice = params.maxPriceCents;
        const tags = params.tags?.map((tag) => tag.toLowerCase());
        return (
          (!keyword ||
            listing.title.toLowerCase().includes(keyword) ||
            listing.description.toLowerCase().includes(keyword)) &&
          (!status || listing.status === status) &&
          (!sellerId || listing.sellerId === sellerId) &&
          (!maxPrice || listing.priceCents <= maxPrice) &&
          listing.priceCents >= minPrice &&
          (!tags?.length ||
            tags.some((tag) => listing.metadata?.tags?.includes(tag)))
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
      if (!listing) throw new Error("Listing not found");
      return listing;
    },
    create: async (payload: CreateListingDto): Promise<SafeListing> => {
      const listing: SafeListing = {
        ...payload,
        id: uid(),
        sellerId: "mock-user",
        currency: payload.currency ?? "USD",
        status: payload.status ?? "PUBLISHED",
        moderationStatus: "APPROVED",
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
    update: async (
      id: string,
      payload: UpdateListingDto,
    ): Promise<SafeListing> => {
      const listing = await this.listings.get(id);
      Object.assign(listing, payload, { updatedAt: new Date().toISOString() });
      persistMockState(this.state);
      return listing;
    },
    uploadImage: async (
      listingId: string,
      file: Blob,
    ): Promise<ListingImage> => {
      const listing = await this.listings.get(listingId);
      const image: ListingImage = {
        id: uid(),
        bucket: "mock",
        storageKey: "mock",
        url:
          typeof window !== "undefined"
            ? URL.createObjectURL(file)
            : "https://placehold.co/600x400",
        mimeType: "image/jpeg",
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
    listFiltered: async (params: {
      listingId?: string;
      status?: string;
    }): Promise<SafeOrder[]> => {
      return this.state.orders.filter((o) => {
        if (params.status && o.status !== params.status) return false;
        if (
          params.listingId &&
          !o.items.some((item) => item.listingId === params.listingId)
        )
          return false;
        return true;
      });
    },
    get: async (id: string): Promise<SafeOrder> => {
      const order = this.state.orders.find((item) => item.id === id);
      if (!order) throw new Error("Order not found");
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
        status: "PENDING",
        paymentStatus: "PENDING",
        totalItemCents: listing.priceCents * (payload.items[0].quantity ?? 1),
        shippingCents: payload.shippingCents ?? 0,
        feeCents: payload.feeCents ?? 0,
        feePercent: 0,
        currency: payload.currency ?? listing.currency ?? "USD",
        metadata: payload.metadata ?? null,
        placedAt: now,
        timeline: [
          {
            id: uid(),
            orderId: id,
            status: "PENDING",
            note: null,
            createdAt: now,
          },
        ],
        items: [
          {
            id: uid(),
            listingId: listing.id,
            listingTitle: listing.title,
            variantId: payload.items[0].variantId ?? null,
            variantLabel:
              listing.variants.find(
                (variant) => variant.id === payload.items[0].variantId,
              )?.label ?? null,
            quantity: payload.items[0].quantity ?? 1,
            unitPriceCents: listing.priceCents,
            currency: listing.currency ?? "USD",
            metadata: null,
          },
        ],
        shipments: [],
        escrow: {
          id: uid(),
          status: "HOLDING",
          amountCents: listing.priceCents,
          currency: listing.currency ?? "USD",
          releaseDate: null,
        },
        payments: [],
      } as SafeOrder;
      this.state.orders.unshift(order);
      persistMockState(this.state);
      return order;
    },
    updateStatus: async (
      id: string,
      payload: { status: string },
    ): Promise<SafeOrder> => {
      const order = await this.orders.get(id);
      order.status = payload.status as SafeOrder["status"];
      order.timeline.push({
        id: uid(),
        orderId: id,
        status: payload.status as SafeOrder["status"],
        note: null,
        createdAt: new Date().toISOString(),
      });
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
      if (!thread) throw new Error("Thread not found");
      return thread;
    },
    createThread: async (): Promise<SafeMessageThread> => {
      const thread = await this.messaging.getThread("thread-sample");
      return thread;
    },
    sendMessage: async (
      threadId: string,
      payload: SendMessageDto,
      attachments?: Blob[],
    ): Promise<SafeMessageThread> => {
      const thread = await this.messaging.getThread(threadId);
      const message: Message = {
        id: uid(),
        threadId,
        authorId: payload.authorId,
        body: payload.body,
        status: "SENT",
        moderationStatus: payload.body.includes("bad") ? "FLAGGED" : "APPROVED",
        moderationNotes: null,
        metadata: payload.metadata ?? null,
        createdAt: new Date().toISOString(),
        attachments:
          attachments?.map((file) => ({
            id: uid(),
            url:
              typeof window !== "undefined"
                ? URL.createObjectURL(file)
                : "https://placehold.co/400",
            fileName: "upload.jpg",
            mimeType: "image/jpeg",
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
    forListing: async (_listingId: string): Promise<ListingReviewResponse> => {
      // Mock empty reviews for now
      return {
        reviews: [],
        rollup: {
          sellerId: "mock-seller",
          averageRating: 0,
          reviewCount: 0,
          publishedCount: 0,
          pendingCount: 0,
          flaggedCount: 0,
          lastReviewAt: null,
        },
      };
    },
    create: async (payload: CreateReviewDto): Promise<SafeReview> => {
      // Mock creation
      return {
        id: uid(),
        reviewerId: payload.reviewerId,
        recipientId: payload.recipientId,
        listingId: payload.listingId,
        orderId: payload.orderId,
        rating: payload.rating,
        comment: payload.comment,
        status: "PUBLISHED",
        moderationNotes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reviewer: {
          id: payload.reviewerId,
          email: "reviewer@example.com",
          name: "Mock Reviewer",
          role: "BUYER",
        },
        flags: [],
        verifiedPurchase: false,
        helpfulCount: 0,
        userVoted: false,
      } as SafeReview;
    },
    rollup: async (sellerId: string): Promise<ReviewRollup> => {
      return {
        sellerId,
        averageRating: 5,
        reviewCount: 1,
        publishedCount: 1,
        pendingCount: 0,
        flaggedCount: 0,
        lastReviewAt: new Date().toISOString(),
      };
    },
  };

  admin = {
    listKycSubmissions: async (): Promise<AdminKycSubmission[]> => {
      return this.state.kycSubmissions;
    },
    reviewKycSubmission: async (
      id: string,
      payload: {
        status: AdminKycSubmission["status"];
        rejectionReason?: string | null;
      },
    ): Promise<AdminKycSubmission> => {
      const submission = this.state.kycSubmissions.find(
        (item) => item.id === id,
      );
      if (!submission) throw new Error("Submission not found");
      submission.status = payload.status;
      submission.rejectionReason = payload.rejectionReason ?? null;
      submission.reviewedAt = new Date().toISOString();
      submission.reviewer = {
        id: submission.reviewer?.id ?? "reviewer-mock",
        email: submission.reviewer?.email ?? "admin@example.com",
        name: submission.reviewer?.name ?? "Console Reviewer",
      };
      persistMockState(this.state);
      return submission;
    },
    listListingsForReview: async (): Promise<AdminListingModeration[]> => {
      return this.state.moderationQueue;
    },
    reviewListing: async (
      id: string,
      payload: {
        moderationStatus: AdminListingModeration["moderationStatus"];
        moderationNotes?: string | null;
      },
    ): Promise<AdminListingModeration> => {
      const listing = this.state.moderationQueue.find((item) => item.id === id);
      if (!listing) throw new Error("Listing not found");
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
      payload: {
        status: AdminDisputeSummary["status"];
        resolution?: string | null;
      },
    ): Promise<AdminDisputeSummary> => {
      const dispute = this.state.disputes.find((item) => item.id === id);
      if (!dispute) throw new Error("Dispute not found");
      dispute.status = payload.status;
      dispute.resolution = payload.resolution ?? null;
      dispute.resolvedAt = new Date().toISOString();
      persistMockState(this.state);
      return dispute;
    },
  };

  auctions = {
    create: async (payload: CreateAuctionDto): Promise<Auction> => {
      const auction: Auction = {
        id: uid(),
        listingId: payload.listingId,
        sellerId: "seller-sample",
        status: "ACTIVE",
        startingBidCents: payload.startingBidCents,
        currency: "USD",
        reserveCents: payload.reserveCents ?? null,
        buyNowCents: payload.buyNowCents ?? null,
        startAt: new Date().toISOString(),
        endAt: new Date(
          Date.now() + 86400000 * payload.durationDays,
        ).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentBidCents: payload.startingBidCents,
        bidCount: 0,
      };
      return auction;
    },
    get: async (id: string): Promise<Auction> => {
      return {
        id,
        listingId: "listing-sample",
        sellerId: "seller-sample",
        status: "ACTIVE",
        startingBidCents: 1000,
        currency: "USD",
        reserveCents: null,
        buyNowCents: null,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentBidCents: 1500,
        bidCount: 3,
        listing: this.state.listings[0],
      };
    },
    placeBid: async (id: string, payload: PlaceBidDto): Promise<Auction> => {
      const auction = await this.auctions.get(id);
      auction.currentBidCents = payload.amountCents;
      auction.bidCount = (auction.bidCount ?? 0) + 1;
      return auction;
    },
  };

  storefronts = {
    create: async (payload: CreateStorefrontDto): Promise<Storefront> => {
      const storefront: Storefront = {
        id: uid(),
        userId: "seller-sample",
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        collections: [],
      };
      return storefront;
    },
    get: async (slug: string): Promise<Storefront> => {
      return {
        id: uid(),
        userId: "seller-sample",
        name: "Mock Store",
        slug,
        description: "A mock storefront for testing",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          id: "seller-sample",
          email: "seller@example.com",
          name: "Mock Seller",
        },
        collections: [],
      };
    },
  };
}

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export const apiClient = createApiClient();
