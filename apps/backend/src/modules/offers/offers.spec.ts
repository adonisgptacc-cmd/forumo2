import { CanActivate, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { ListingStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { PrismaService } from "../../prisma/prisma.service";
import { OffersModule } from "./offers.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CacheService } from "../../common/services/cache.service";

const BUYER_ID = "buyer-1";
const SELLER_ID = "seller-1";
const OTHER_BUYER_ID = "buyer-2";
const LISTING_ID = "listing-pub-1";
const DRAFT_LISTING_ID = "listing-draft-1";

class MockGuard implements CanActivate {
  static userId = BUYER_ID;
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: MockGuard.userId, role: "BUYER" };
    return true;
  }
}

// ─── In-Memory Prisma ────────────────────────────────────────────────────────

class InMemoryPrismaService {
  listings = new Map<string, any>();
  offers = new Map<string, any>();

  constructor() {
    this.listings.set(LISTING_ID, {
      id: LISTING_ID,
      sellerId: SELLER_ID,
      title: "Published Item",
      priceCents: 10000,
      currency: "USD",
      status: ListingStatus.PUBLISHED,
    });
    this.listings.set(DRAFT_LISTING_ID, {
      id: DRAFT_LISTING_ID,
      sellerId: SELLER_ID,
      title: "Draft Item",
      priceCents: 5000,
      currency: "USD",
      status: ListingStatus.DRAFT,
    });
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

  // Stable reference so tests can intercept individual methods.
  offerImpl = {
    findFirst: async ({ where }: any) => {
      for (const offer of this.offers.values()) {
        let match = true;
        if (where.listingId && offer.listingId !== where.listingId)
          match = false;
        if (where.buyerId && offer.buyerId !== where.buyerId) match = false;
        if (where.status && offer.status !== where.status) match = false;
        if (match) return offer;
      }
      return null;
    },
    findUnique: async ({ where }: any) => this.offers.get(where.id) ?? null,
    findMany: async ({ where }: any) => {
      return Array.from(this.offers.values()).filter((o) => {
        if (!where?.OR) return true;
        return where.OR.some((cond: any) => {
          if (cond.buyerId) return o.buyerId === cond.buyerId;
          if (cond.sellerId) return o.sellerId === cond.sellerId;
          return false;
        });
      });
    },
    create: async ({ data }: any) => {
      const id = randomUUID();
      const offer = {
        id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.offers.set(id, offer);
      return offer;
    },
    update: async ({ where, data }: any) => {
      const offer = this.offers.get(where.id);
      if (!offer) return null;
      const updated = { ...offer, ...data };
      this.offers.set(where.id, updated);
      return updated;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const [id, offer] of this.offers.entries()) {
        if (where.id && offer.id !== where.id) continue;
        if (where.listingId && offer.listingId !== where.listingId) continue;
        if (where.status && offer.status !== where.status) continue;
        if (where.NOT?.id && offer.id === where.NOT.id) continue;
        this.offers.set(id, { ...offer, ...data });
        count += 1;
      }
      return { count };
    },
  };

  get offer() {
    return this.offerImpl;
  }

  get order() {
    return {
      create: async ({ data }: any) => ({ id: randomUUID(), ...data }),
    };
  }

  $transaction = async (fn: any) => fn(this);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OffersModule", () => {
  let app: INestApplication;
  let prismaMock: InMemoryPrismaService;

  const buildApp = async (userId = BUYER_ID) => {
    MockGuard.userId = userId;
    prismaMock = new InMemoryPrismaService();
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), OffersModule],
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

  afterEach(async () => await app.close());

  // ── Create ──

  describe("POST /offers", () => {
    it("creates a pending offer on a published listing", async () => {
      await buildApp(BUYER_ID);
      const res = await request(app.getHttpServer())
        .post("/offers")
        .send({
          listingId: LISTING_ID,
          amountCents: 8000,
          message: "Best price?",
        })
        .expect(201);

      expect(res.body.buyerId).toBe(BUYER_ID);
      expect(res.body.sellerId).toBe(SELLER_ID);
      expect(res.body.amountCents).toBe(8000);
      expect(res.body.status).toBe("PENDING");
    });

    it("rejects offer on a non-published listing", async () => {
      await buildApp(BUYER_ID);
      await request(app.getHttpServer())
        .post("/offers")
        .send({ listingId: DRAFT_LISTING_ID, amountCents: 4000 })
        .expect(400);
    });

    it("rejects seller making offer on own listing", async () => {
      await buildApp(SELLER_ID);
      await request(app.getHttpServer())
        .post("/offers")
        .send({ listingId: LISTING_ID, amountCents: 8000 })
        .expect(403);
    });

    it("rejects duplicate pending offer from same buyer", async () => {
      await buildApp(BUYER_ID);
      await request(app.getHttpServer())
        .post("/offers")
        .send({ listingId: LISTING_ID, amountCents: 8000 })
        .expect(201);

      await request(app.getHttpServer())
        .post("/offers")
        .send({ listingId: LISTING_ID, amountCents: 9000 })
        .expect(400);
    });

    it("returns 404 for unknown listing", async () => {
      await buildApp(BUYER_ID);
      await request(app.getHttpServer())
        .post("/offers")
        .send({ listingId: "no-such-listing", amountCents: 5000 })
        .expect(404);
    });
  });

  // ── List ──

  describe("GET /offers", () => {
    it("returns offers for the authenticated user", async () => {
      await buildApp(BUYER_ID);
      await request(app.getHttpServer())
        .post("/offers")
        .send({ listingId: LISTING_ID, amountCents: 7000 });

      const res = await request(app.getHttpServer()).get("/offers").expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].buyerId).toBe(BUYER_ID);
    });
  });

  // ── Accept ──

  describe("POST /offers/:id/accept", () => {
    let offerId: string;

    beforeEach(async () => {
      await buildApp(BUYER_ID);
      const createRes = await request(app.getHttpServer())
        .post("/offers")
        .send({ listingId: LISTING_ID, amountCents: 8500 });
      offerId = createRes.body.id;
    });

    it("seller accepts a pending offer and creates an order", async () => {
      MockGuard.userId = SELLER_ID;
      const res = await request(app.getHttpServer())
        .post(`/offers/${offerId}/accept`)
        .expect(201);

      expect(res.body.status).toBe("ACCEPTED");
      // Listing should be paused
      expect(prismaMock.listings.get(LISTING_ID)!.status).toBe(
        ListingStatus.PAUSED,
      );
    });

    it("rejects acceptance by the buyer", async () => {
      MockGuard.userId = BUYER_ID;
      await request(app.getHttpServer())
        .post(`/offers/${offerId}/accept`)
        .expect(403);
    });

    it("rejects acceptance of an already accepted offer", async () => {
      MockGuard.userId = SELLER_ID;
      await request(app.getHttpServer()).post(`/offers/${offerId}/accept`);
      await request(app.getHttpServer())
        .post(`/offers/${offerId}/accept`)
        .expect(400);
    });

    it("rejects acceptance of an expired offer", async () => {
      // Manually expire the offer
      const offer = prismaMock.offers.get(offerId)!;
      offer.expiresAt = new Date(Date.now() - 1000);
      prismaMock.offers.set(offerId, offer);

      MockGuard.userId = SELLER_ID;
      await request(app.getHttpServer())
        .post(`/offers/${offerId}/accept`)
        .expect(400);
    });

    it("returns 400 when a concurrent accept wins the race", async () => {
      // Simulate another transaction already flipping the offer to ACCEPTED
      // between the read and the guarded write.
      const originalUpdateMany = prismaMock.offerImpl.updateMany;
      prismaMock.offerImpl.updateMany = (async ({ where }: any) => {
        if (where.id === offerId && where.status === "PENDING") {
          return { count: 0 };
        }
        return originalUpdateMany({
          where,
          data: { status: "DECLINED" },
        } as any);
      }) as any;

      MockGuard.userId = SELLER_ID;
      await request(app.getHttpServer())
        .post(`/offers/${offerId}/accept`)
        .expect(400);

      expect(prismaMock.offers.get(offerId)!.status).toBe("PENDING");
    });
  });

  // ── Decline ──

  describe("POST /offers/:id/decline", () => {
    let offerId: string;

    beforeEach(async () => {
      await buildApp(BUYER_ID);
      const createRes = await request(app.getHttpServer())
        .post("/offers")
        .send({ listingId: LISTING_ID, amountCents: 7500 });
      offerId = createRes.body.id;
    });

    it("seller declines a pending offer", async () => {
      MockGuard.userId = SELLER_ID;
      const res = await request(app.getHttpServer())
        .post(`/offers/${offerId}/decline`)
        .expect(201);

      expect(res.body.status).toBe("DECLINED");
    });

    it("rejects decline by the buyer", async () => {
      MockGuard.userId = BUYER_ID;
      await request(app.getHttpServer())
        .post(`/offers/${offerId}/decline`)
        .expect(403);
    });

    it("rejects decline of an already declined offer", async () => {
      MockGuard.userId = SELLER_ID;
      await request(app.getHttpServer()).post(`/offers/${offerId}/decline`);
      await request(app.getHttpServer())
        .post(`/offers/${offerId}/decline`)
        .expect(400);
    });

    it("rejects decline of an expired offer", async () => {
      const offer = prismaMock.offers.get(offerId)!;
      offer.expiresAt = new Date(Date.now() - 1000);
      prismaMock.offers.set(offerId, offer);

      MockGuard.userId = SELLER_ID;
      await request(app.getHttpServer())
        .post(`/offers/${offerId}/decline`)
        .expect(400);
    });

    it("returns 404 for unknown offer", async () => {
      MockGuard.userId = SELLER_ID;
      await request(app.getHttpServer())
        .post("/offers/does-not-exist/decline")
        .expect(404);
    });
  });
});
