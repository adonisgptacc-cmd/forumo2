import { CanActivate, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { PrismaService } from "../../prisma/prisma.service";
import { WishlistModule } from "./wishlist.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const LISTING_ID = "listing-1";
const LISTING_ID_2 = "listing-2";

class MockGuard implements CanActivate {
  static userId = USER_ID;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: MockGuard.userId, role: "BUYER" };
    return true;
  }
}

// ─── In-Memory Prisma ─────────────────────────────────────────────────────────

class InMemoryPrismaService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  listings = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  savedListings = new Map<string, any>(); // key: `${userId}_${listingId}`

  constructor() {
    this.listings.set(LISTING_ID, {
      id: LISTING_ID,
      title: "Test Listing",
      priceCents: 5000,
      currency: "USD",
      status: "PUBLISHED",
      images: [],
    });
    this.listings.set(LISTING_ID_2, {
      id: LISTING_ID_2,
      title: "Another Listing",
      priceCents: 3000,
      currency: "USD",
      status: "PUBLISHED",
      images: [],
    });
  }

  get listing() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findUnique: async ({ where }: any) => this.listings.get(where.id) ?? null,
    };
  }

  get savedListing() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findMany: async ({ where }: any) => {
        return Array.from(this.savedListings.values())
          .filter((sl) => sl.userId === where.userId)
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((sl) => {
            const listing = this.listings.get(sl.listingId);
            return {
              ...sl,
              listing: listing
                ? {
                    id: listing.id,
                    title: listing.title,
                    priceCents: listing.priceCents,
                    currency: listing.currency,
                    status: listing.status,
                    images: [],
                  }
                : null,
            };
          });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findUnique: async ({ where }: any) => {
        const { userId, listingId } = where.userId_listingId;
        return this.savedListings.get(`${userId}_${listingId}`) ?? null;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: async ({ data }: any) => {
        const key = `${data.userId}_${data.listingId}`;
        const sl = { id: randomUUID(), ...data, createdAt: new Date() };
        this.savedListings.set(key, sl);
        const listing = this.listings.get(data.listingId);
        return {
          ...sl,
          listing: listing
            ? {
                id: listing.id,
                title: listing.title,
                priceCents: listing.priceCents,
                currency: listing.currency,
                status: listing.status,
              }
            : null,
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      delete: async ({ where }: any) => {
        const { userId, listingId } = where.userId_listingId;
        const key = `${userId}_${listingId}`;
        const item = this.savedListings.get(key);
        this.savedListings.delete(key);
        return item;
      },
    };
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WishlistModule", () => {
  let app: INestApplication;
  let prismaMock: InMemoryPrismaService;

  const buildApp = async (userId = USER_ID) => {
    MockGuard.userId = userId;
    prismaMock = new InMemoryPrismaService();
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), WishlistModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideGuard(JwtAuthGuard)
      .useClass(MockGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  };

  afterEach(async () => await app.close());

  // ── GET /wishlist ──

  describe("GET /wishlist", () => {
    it("returns an empty list when nothing is saved", async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .get("/wishlist")
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it("returns saved listings for the authenticated user", async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post(`/wishlist/${LISTING_ID}`)
        .expect(201);
      const res = await request(app.getHttpServer())
        .get("/wishlist")
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].listingId).toBe(LISTING_ID);
    });

    it("does not return items saved by another user", async () => {
      await buildApp(USER_ID);
      await request(app.getHttpServer()).post(`/wishlist/${LISTING_ID}`);
      // Switch to a different user
      MockGuard.userId = OTHER_USER_ID;
      const res = await request(app.getHttpServer())
        .get("/wishlist")
        .expect(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // ── POST /wishlist/:listingId ──

  describe("POST /wishlist/:listingId", () => {
    it("saves a listing and returns it with listing details", async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .post(`/wishlist/${LISTING_ID}`)
        .expect(201);

      expect(res.body.listingId).toBe(LISTING_ID);
      expect(res.body.userId).toBe(USER_ID);
      expect(res.body.listing.title).toBe("Test Listing");
    });

    it("returns 404 for an unknown listing", async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post("/wishlist/nonexistent-listing")
        .expect(404);
    });

    it("returns 409 when the listing is already saved", async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post(`/wishlist/${LISTING_ID}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/wishlist/${LISTING_ID}`)
        .expect(409);
    });

    it("allows the same listing to be saved by two different users", async () => {
      await buildApp(USER_ID);
      await request(app.getHttpServer())
        .post(`/wishlist/${LISTING_ID}`)
        .expect(201);
      MockGuard.userId = OTHER_USER_ID;
      await request(app.getHttpServer())
        .post(`/wishlist/${LISTING_ID}`)
        .expect(201);
    });
  });

  // ── DELETE /wishlist/:listingId ──

  describe("DELETE /wishlist/:listingId", () => {
    it("removes a saved listing and it no longer appears in the wishlist", async () => {
      await buildApp();
      await request(app.getHttpServer()).post(`/wishlist/${LISTING_ID}`);
      await request(app.getHttpServer())
        .delete(`/wishlist/${LISTING_ID}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get("/wishlist")
        .expect(200);
      expect(res.body).toHaveLength(0);
    });

    it("returns 404 when trying to remove an item that was never saved", async () => {
      await buildApp();
      await request(app.getHttpServer())
        .delete(`/wishlist/${LISTING_ID}`)
        .expect(404);
    });
  });

  // ── GET /wishlist/:listingId/check ──

  describe("GET /wishlist/:listingId/check", () => {
    it("returns { saved: true } when the listing is in the wishlist", async () => {
      await buildApp();
      await request(app.getHttpServer()).post(`/wishlist/${LISTING_ID}`);
      const res = await request(app.getHttpServer())
        .get(`/wishlist/${LISTING_ID}/check`)
        .expect(200);
      expect(res.body.saved).toBe(true);
    });

    it("returns { saved: false } when the listing is not in the wishlist", async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .get(`/wishlist/${LISTING_ID}/check`)
        .expect(200);
      expect(res.body.saved).toBe(false);
    });

    it("returns { saved: false } for a listing saved by a different user", async () => {
      await buildApp(OTHER_USER_ID);
      await request(app.getHttpServer()).post(`/wishlist/${LISTING_ID}`);
      MockGuard.userId = USER_ID;
      const res = await request(app.getHttpServer())
        .get(`/wishlist/${LISTING_ID}/check`)
        .expect(200);
      expect(res.body.saved).toBe(false);
    });
  });
});
