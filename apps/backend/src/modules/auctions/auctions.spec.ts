import { CanActivate, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { AuctionStatus, ListingStatus, ListingType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { PrismaService } from "../../prisma/prisma.service";
import { AuctionsModule } from "./auctions.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CacheService } from "../../common/services/cache.service";

const SELLER_ID = "seller-1";
const BIDDER_ID = "bidder-1";
const BIDDER_2_ID = "bidder-2";
const LISTING_ID = "listing-draft-1";
const AUCTION_ID = "auction-1";

// Mock the AuctionsGateway so we don't need a real WebSocket server
jest.mock("./auctions.gateway", () => ({
  AuctionsGateway: jest.fn().mockImplementation(() => ({
    emitBid: jest.fn(),
    emitAuctionEnd: jest.fn(),
  })),
}));

class MockGuard implements CanActivate {
  static userId = BIDDER_ID;
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: MockGuard.userId, role: "BUYER" };
    return true;
  }
}

// ─── In-Memory Prisma ───────────────────────────────────────────────────────

class InMemoryPrismaService {
  listings = new Map<string, any>();
  auctions = new Map<string, any>();
  bids = new Map<string, any[]>(); // auctionId → bids[]
  notifications: any[] = [];

  constructor() {
    this.listings.set(LISTING_ID, {
      id: LISTING_ID,
      sellerId: SELLER_ID,
      title: "Draft Item for Auction",
      priceCents: 5000,
      currency: "USD",
      status: ListingStatus.DRAFT,
      type: null,
      images: [],
      variants: [],
    });

    // Pre-seed an active auction for bid tests
    const endAt = new Date(Date.now() + 3600000); // 1 hour from now
    this.auctions.set(AUCTION_ID, {
      id: AUCTION_ID,
      listingId: LISTING_ID,
      sellerId: SELLER_ID,
      status: AuctionStatus.ACTIVE,
      startingBidCents: 1000,
      reserveCents: null,
      buyNowCents: null,
      startAt: new Date(),
      endAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      listing: this.listings.get(LISTING_ID),
      seller: { id: SELLER_ID, name: "Seller", avatarUrl: null },
      _count: { bids: 0 },
    });
    this.bids.set(AUCTION_ID, []);
  }

  get auction() {
    const self = this;
    return {
      findMany: async ({ where, skip = 0, take = 12 }: any) => {
        let all = Array.from(self.auctions.values());
        if (where?.status) all = all.filter((a) => a.status === where.status);
        return all.slice(skip, skip + take).map((a) => ({
          ...a,
          _count: { bids: (self.bids.get(a.id) ?? []).length },
        }));
      },
      count: async ({ where }: any) => {
        let all = Array.from(self.auctions.values());
        if (where?.status) all = all.filter((a) => a.status === where.status);
        return all.length;
      },
      findUnique: async ({ where, include }: any) => {
        const a = self.auctions.get(where.id);
        if (!a) return null;
        const bids = self.bids.get(a.id) ?? [];
        return {
          ...a,
          bids: include?.bids ? [...bids].reverse().slice(0, 10) : undefined,
          _count: { bids: bids.length },
        };
      },
      create: async ({ data }: any) => {
        const id = randomUUID();
        const auction = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        self.auctions.set(id, auction);
        self.bids.set(id, []);
        return auction;
      },
      update: async ({ where, data }: any) => {
        const a = self.auctions.get(where.id);
        if (!a) return null;
        const updated = { ...a, ...data, updatedAt: new Date() };
        self.auctions.set(where.id, updated);
        return updated;
      },
    };
  }

  get listing() {
    const self = this;
    return {
      findUnique: async ({ where }: any) => self.listings.get(where.id) ?? null,
      update: async ({ where, data }: any) => {
        const l = self.listings.get(where.id);
        if (!l) return null;
        const updated = { ...l, ...data };
        self.listings.set(where.id, updated);
        return updated;
      },
    };
  }

  get bid() {
    const self = this;
    return {
      findFirst: async ({ where, orderBy }: any) => {
        const bids = self.bids.get(where.auctionId) ?? [];
        if (!bids.length) return null;
        // Sort by amountCents desc to get highest
        const sorted = [...bids].sort((a, b) => b.amountCents - a.amountCents);
        return sorted[0];
      },
      create: async ({ data, include }: any) => {
        const id = randomUUID();
        const bid = {
          id,
          ...data,
          createdAt: new Date(),
          bidder: { id: data.bidderId, name: "Bidder", avatarUrl: null },
        };
        const bids = self.bids.get(data.auctionId) ?? [];
        bids.push(bid);
        self.bids.set(data.auctionId, bids);
        return bid;
      },
      update: async ({ where, data, include }: any) => {
        const auctionId = where.id ? self._findBidAuctionId(where.id) : null;
        if (!auctionId) return null;
        const bids = self.bids.get(auctionId)!;
        const idx = bids.findIndex((b) => b.id === where.id);
        if (idx === -1) return null;
        const updated = { ...bids[idx], ...data };
        bids[idx] = updated;
        return updated;
      },
    };
  }

  _findBidAuctionId(bidId: string): string | null {
    for (const [auctionId, bids] of this.bids.entries()) {
      if (bids.some((b) => b.id === bidId)) return auctionId;
    }
    return null;
  }

  $transaction = async (fn: any) => {
    return fn(this);
  };

  // Notifications stub (required by NotificationsModule)
  get notification() {
    return {
      create: async (data: any) => ({ id: randomUUID(), ...data }),
      findMany: async () => [],
    };
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AuctionsModule", () => {
  let app: INestApplication;
  let prismaMock: InMemoryPrismaService;

  const buildApp = async (userId = BIDDER_ID) => {
    MockGuard.userId = userId;
    prismaMock = new InMemoryPrismaService();
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AuctionsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(CacheService)
      .useValue({ deleteByPrefix: jest.fn().mockResolvedValue(0) })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  };

  afterEach(async () => {
    await app.close();
  });

  // ── List ──

  describe("GET /auctions", () => {
    it("returns paginated active auctions", async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .get("/auctions")
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(AUCTION_ID);
      expect(res.body.page).toBe(1);
      expect(res.body.pageCount).toBe(1);
    });

    it("filters by status", async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .get("/auctions?status=COMPLETED")
        .expect(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // ── Get one ──

  describe("GET /auctions/:id", () => {
    it("returns auction with bids", async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .get(`/auctions/${AUCTION_ID}`)
        .expect(200);

      expect(res.body.id).toBe(AUCTION_ID);
      expect(res.body.status).toBe(AuctionStatus.ACTIVE);
    });

    it("returns 404 for unknown auction", async () => {
      await buildApp();
      await request(app.getHttpServer())
        .get("/auctions/does-not-exist")
        .expect(404);
    });
  });

  // ── Create ──

  describe("POST /auctions", () => {
    it("creates auction from a draft listing owned by seller", async () => {
      await buildApp(SELLER_ID);
      const res = await request(app.getHttpServer())
        .post("/auctions")
        .send({
          listingId: LISTING_ID,
          startingBidCents: 5000,
          durationDays: 7,
        })
        .expect(201);

      expect(res.body.listingId).toBe(LISTING_ID);
      expect(res.body.status).toBe(AuctionStatus.ACTIVE);
      expect(res.body.startingBidCents).toBe(5000);
      // Listing should be updated to AUCTION type and PUBLISHED
      const listing = prismaMock.listings.get(LISTING_ID)!;
      expect(listing.type).toBe(ListingType.AUCTION);
      expect(listing.status).toBe(ListingStatus.PUBLISHED);
    });

    it("rejects creation if listing does not exist", async () => {
      await buildApp(SELLER_ID);
      await request(app.getHttpServer())
        .post("/auctions")
        .send({
          listingId: "no-such-listing",
          startingBidCents: 1000,
          durationDays: 3,
        })
        .expect(404);
    });

    it("rejects if caller is not the listing owner", async () => {
      await buildApp(BIDDER_ID); // not the seller
      await request(app.getHttpServer())
        .post("/auctions")
        .send({
          listingId: LISTING_ID,
          startingBidCents: 1000,
          durationDays: 3,
        })
        .expect(403);
    });
  });

  // ── Bidding ──

  describe("POST /auctions/:id/bids", () => {
    it("places the first bid at starting price", async () => {
      await buildApp(BIDDER_ID);
      const res = await request(app.getHttpServer())
        .post(`/auctions/${AUCTION_ID}/bids`)
        .send({ amountCents: 1000 })
        .expect(201);

      expect(res.body.bidderId).toBe(BIDDER_ID);
      expect(res.body.amountCents).toBe(1000);
    });

    it("rejects a bid below the minimum", async () => {
      await buildApp(BIDDER_ID);
      // Place first bid to set current price
      await request(app.getHttpServer())
        .post(`/auctions/${AUCTION_ID}/bids`)
        .send({ amountCents: 1000 });

      // Try to bid same amount (must be higher)
      await request(app.getHttpServer())
        .post(`/auctions/${AUCTION_ID}/bids`)
        .send({ amountCents: 1000 })
        .expect(400);
    });

    it("rejects a seller bidding on own auction", async () => {
      await buildApp(SELLER_ID);
      await request(app.getHttpServer())
        .post(`/auctions/${AUCTION_ID}/bids`)
        .send({ amountCents: 1000 })
        .expect(403);
    });

    it("returns 404 for unknown auction", async () => {
      await buildApp(BIDDER_ID);
      await request(app.getHttpServer())
        .post("/auctions/no-such-auction/bids")
        .send({ amountCents: 1000 })
        .expect(404);
    });

    it("proxy bid: existing bidder wins when outbid within max", async () => {
      await buildApp(BIDDER_ID);
      // BIDDER_1 places auto-bid with max 5000
      await request(app.getHttpServer())
        .post(`/auctions/${AUCTION_ID}/bids`)
        .send({ amountCents: 1000, maxAutoBidCents: 5000 });

      // BIDDER_2 bids 2000 — BIDDER_1 should stay on top at ~2100
      MockGuard.userId = BIDDER_2_ID;
      const res = await request(app.getHttpServer())
        .post(`/auctions/${AUCTION_ID}/bids`)
        .send({ amountCents: 2000 })
        .expect(201);

      // The winning bid should be for BIDDER_1 (proxy), amount above BIDDER_2
      expect(res.body.bidderId).toBe(BIDDER_ID);
    });

    it("anti-sniping extends auction when bid placed in last 2 minutes", async () => {
      await buildApp(BIDDER_ID);

      // Set auction to end in 90 seconds
      const almostEndingAuction = prismaMock.auctions.get(AUCTION_ID)!;
      almostEndingAuction.endAt = new Date(Date.now() + 90000);
      prismaMock.auctions.set(AUCTION_ID, almostEndingAuction);

      const originalEndAt = almostEndingAuction.endAt.getTime();

      await request(app.getHttpServer())
        .post(`/auctions/${AUCTION_ID}/bids`)
        .send({ amountCents: 1000 })
        .expect(201);

      const updated = prismaMock.auctions.get(AUCTION_ID)!;
      expect(updated.endAt.getTime()).toBeGreaterThan(originalEndAt);
    });

    it("rejects bid on ended auction", async () => {
      await buildApp(BIDDER_ID);

      // Set auction to already ended
      const auction = prismaMock.auctions.get(AUCTION_ID)!;
      auction.endAt = new Date(Date.now() - 1000);
      prismaMock.auctions.set(AUCTION_ID, auction);

      await request(app.getHttpServer())
        .post(`/auctions/${AUCTION_ID}/bids`)
        .send({ amountCents: 1000 })
        .expect(400);
    });
  });
});
