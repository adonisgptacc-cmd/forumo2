import { CanActivate, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { AuctionStatus, ListingStatus, ListingType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { PrismaService } from "../../prisma/prisma.service";
import { AuctionsModule } from "./auctions.module";
import { AuctionEndProcessor } from "./processors/auction-end.processor";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CacheService } from "../../common/services/cache.service";
import { FeeService } from "../fees/fee.service";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: MockGuard.userId, role: "BUYER" };
    return true;
  }
}

// ─── In-Memory Prisma ───────────────────────────────────────────────────────

class InMemoryPrismaService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  listings = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  auctions = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  bids = new Map<string, any[]>(); // auctionId → bids[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
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

    // Seed users for auction-end notification lookups
    this.users.set(SELLER_ID, {
      id: SELLER_ID,
      email: "seller@test.com",
      name: "Seller",
    });
    this.users.set(BIDDER_ID, {
      id: BIDDER_ID,
      email: "bidder@test.com",
      name: "Bidder",
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
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findMany: async ({ where, skip = 0, take = 12 }: any) => {
        let all = Array.from(this.auctions.values());
        if (where?.status) all = all.filter((a) => a.status === where.status);
        return all.slice(skip, skip + take).map((a) => ({
          ...a,
          _count: { bids: (this.bids.get(a.id) ?? []).length },
        }));
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      count: async ({ where }: any) => {
        let all = Array.from(this.auctions.values());
        if (where?.status) all = all.filter((a) => a.status === where.status);
        return all.length;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findUnique: async ({ where, include }: any) => {
        const a = this.auctions.get(where.id);
        if (!a) return null;
        const bids = this.bids.get(a.id) ?? [];
        return {
          ...a,
          bids: include?.bids ? [...bids].reverse().slice(0, 10) : undefined,
          _count: { bids: bids.length },
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: async ({ data }: any) => {
        const id = randomUUID();
        const auction = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.auctions.set(id, auction);
        this.bids.set(id, []);
        return auction;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      update: async ({ where, data }: any) => {
        const a = this.auctions.get(where.id);
        if (!a) return null;
        const updated = { ...a, ...data, updatedAt: new Date() };
        this.auctions.set(where.id, updated);
        return updated;
      },
    };
  }

  get listing() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findUnique: async ({ where }: any) => this.listings.get(where.id) ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      update: async ({ where, data }: any) => {
        const l = this.listings.get(where.id);
        if (!l) return null;
        const updated = { ...l, ...data };
        this.listings.set(where.id, updated);
        return updated;
      },
    };
  }

  get bid() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findFirst: async ({ where, orderBy: _orderBy }: any) => {
        const bids = this.bids.get(where.auctionId) ?? [];
        if (!bids.length) return null;
        // Sort by amountCents desc to get highest
        const sorted = [...bids].sort((a, b) => b.amountCents - a.amountCents);
        return sorted[0];
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: async ({ data, include: _include }: any) => {
        const id = randomUUID();
        const bid = {
          id,
          ...data,
          createdAt: new Date(),
          bidder: { id: data.bidderId, name: "Bidder", avatarUrl: null },
        };
        const bids = this.bids.get(data.auctionId) ?? [];
        bids.push(bid);
        this.bids.set(data.auctionId, bids);
        return bid;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      update: async ({ where, data, include: _include }: any) => {
        const auctionId = where.id ? this._findBidAuctionId(where.id) : null;
        if (!auctionId) return null;
        const bids = this.bids.get(auctionId)!;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  $transaction = async (fn: any) => {
    return fn(this);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  $executeRawSpy = jest.fn(async (..._args: any[]) => 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  $executeRaw = (...args: any[]) => this.$executeRawSpy(...args);

  // Notifications stub (required by NotificationsModule)
  get notification() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: async (data: any) => ({ id: randomUUID(), ...data }),
      findMany: async () => [],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  orders = new Map<string, any>();

  get order() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findUnique: async ({ where }: any) => {
        if (where.auctionId !== undefined) {
          for (const o of this.orders.values()) {
            if (o.auctionId === where.auctionId) return o;
          }
          return null;
        }
        return this.orders.get(where.id) ?? null;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: async ({ data }: any) => {
        const id = randomUUID();
        const order = { id, ...data };
        this.orders.set(id, order);
        return order;
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  users = new Map<string, any>();

  get user() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findUnique: async ({ where }: any) => this.users.get(where.id) ?? null,
    };
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AuctionsModule", () => {
  let app: INestApplication;
  let prismaMock: InMemoryPrismaService;

  const buildApp = async (userId = BIDDER_ID) => {
    MockGuard.userId = userId;
    // FeesModule → AuthModule requires JWT_SECRET at JwtModule factory time.
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret";
    prismaMock = new InMemoryPrismaService();
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AuctionsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(CacheService)
      .useValue({ deleteByPrefix: jest.fn().mockResolvedValue(0) })
      .overrideProvider(FeeService)
      .useValue({
        calculateFee: jest.fn().mockResolvedValue({
          feeAmountCents: 50,
          feePercent: 5,
          breakdown: { percentPart: 50, fixedPart: 0 },
        }),
        getFeeScheduleForListing: jest.fn().mockResolvedValue(null),
      })
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
      // Listing should be updated to AUCTION type and PAUSED pending moderation
      const listing = prismaMock.listings.get(LISTING_ID)!;
      expect(listing.type).toBe(ListingType.AUCTION);
      expect(listing.status).toBe(ListingStatus.PAUSED);
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

    it("begins the bid transaction with a per-auction advisory lock", async () => {
      await buildApp(BIDDER_ID);
      await request(app.getHttpServer())
        .post(`/auctions/${AUCTION_ID}/bids`)
        .send({ amountCents: 1000 })
        .expect(201);

      expect(prismaMock.$executeRawSpy).toHaveBeenCalled();
      const [sqlParts, lockKey] = prismaMock.$executeRawSpy.mock.calls[0];
      expect(sqlParts.join("")).toContain("pg_advisory_xact_lock");
      expect(lockKey).toBe(AUCTION_ID);
    });
  });

  // ── Auction settlement (AuctionEndProcessor) ──

  describe("auction end processor", () => {
    it("creates the winner order with a computed platform fee and dedupes reruns", async () => {
      await buildApp(BIDDER_ID);

      // End the auction, then place the winning bid through the API
      const ended = prismaMock.auctions.get(AUCTION_ID)!;
      ended.endAt = new Date(Date.now() - 1000);
      prismaMock.auctions.set(AUCTION_ID, ended);

      await request(app.getHttpServer())
        .post(`/auctions/${AUCTION_ID}/bids`)
        .send({ amountCents: 1000 })
        .expect(400); // already ended — bid rejected

      // Seed the winning bid directly (auction was live when the bid arrived)
      const live = prismaMock.auctions.get(AUCTION_ID)!;
      live.endAt = new Date(Date.now() + 60000);
      prismaMock.auctions.set(AUCTION_ID, live);
      const bidRes = await request(app.getHttpServer())
        .post(`/auctions/${AUCTION_ID}/bids`)
        .send({ amountCents: 5000 })
        .expect(201);
      expect(bidRes.body.amountCents).toBe(1000); // first bid lands at starting price

      // End the auction again so the cron settles it
      const finalState = prismaMock.auctions.get(AUCTION_ID)!;
      finalState.endAt = new Date(Date.now() - 1000);
      prismaMock.auctions.set(AUCTION_ID, finalState);

      const processor = app.get(AuctionEndProcessor);
      await processor.processEndedAuctions();

      const orders = Array.from(prismaMock.orders.values());
      expect(orders).toHaveLength(1);
      expect(orders[0].buyerId).toBe(BIDDER_ID);
      expect(orders[0].totalItemCents).toBe(1000);
      // Fee computed from FeeService mock (5% of 1000)
      expect(orders[0].feeCents).toBe(50);
      expect(orders[0].feePercent).toBe(5);
      expect(orders[0].auctionId).toBe(AUCTION_ID);

      // Listing paused after settlement
      expect(prismaMock.listings.get(LISTING_ID)!.status).toBe(
        ListingStatus.PAUSED,
      );

      // Re-running the cron must not create a duplicate order
      await processor.processEndedAuctions();
      expect(Array.from(prismaMock.orders.values())).toHaveLength(1);
    });

    it("pauses the listing without an order when reserve is not met", async () => {
      await buildApp(BIDDER_ID);

      const withReserve = prismaMock.auctions.get(AUCTION_ID)!;
      withReserve.reserveCents = 90000;
      prismaMock.auctions.set(AUCTION_ID, withReserve);

      // Winning bid below reserve
      const live = prismaMock.auctions.get(AUCTION_ID)!;
      live.endAt = new Date(Date.now() + 60000);
      prismaMock.auctions.set(AUCTION_ID, live);
      await request(app.getHttpServer())
        .post(`/auctions/${AUCTION_ID}/bids`)
        .send({ amountCents: 5000 })
        .expect(201);

      const endedAgain = prismaMock.auctions.get(AUCTION_ID)!;
      endedAgain.endAt = new Date(Date.now() - 1000);
      prismaMock.auctions.set(AUCTION_ID, endedAgain);

      const processor = app.get(AuctionEndProcessor);
      await processor.processEndedAuctions();

      expect(Array.from(prismaMock.orders.values())).toHaveLength(0);
      expect(prismaMock.listings.get(LISTING_ID)!.status).toBe(
        ListingStatus.PAUSED,
      );
    });
  });
});
