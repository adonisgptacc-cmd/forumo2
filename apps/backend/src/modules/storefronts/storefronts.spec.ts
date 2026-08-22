import { CanActivate, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { PrismaService } from "../../prisma/prisma.service";
import { StorefrontsModule } from "./storefronts.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

const USER_ID = "seller-1";
const OTHER_USER_ID = "seller-2";

class MockGuard implements CanActivate {
  static userId = USER_ID;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: MockGuard.userId, role: "SELLER" };
    return true;
  }
}

// ─── In-Memory Prisma ────────────────────────────────────────────────────────

class InMemoryPrismaService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  storefronts = new Map<string, any>(); // keyed by userId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  storefrontsBySlug = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  collections = new Map<string, any>();

  get storefront() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findFirst: async ({ where }: any) => {
        for (const sf of this.storefronts.values()) {
          if (where.OR) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
            const match = where.OR.some((cond: any) => {
              if (cond.slug) return sf.slug === cond.slug;
              if (cond.userId) return sf.userId === cond.userId;
              return false;
            });
            if (match) return sf;
          }
        }
        return null;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findUnique: async ({ where, include }: any) => {
        const sf = where.userId
          ? this.storefronts.get(where.userId)
          : this.storefrontsBySlug.get(where.slug);
        if (!sf) return null;
        return {
          ...sf,
          collections: include?.collections
            ? Array.from(this.collections.values()).filter(
                (c) => c.storefrontId === sf.id,
              )
            : undefined,
          user: include?.user
            ? { id: sf.userId, name: "Test Seller", avatarUrl: null }
            : undefined,
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: async ({ data }: any) => {
        const sf = {
          id: randomUUID(),
          ...data,
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
          collections: [],
        };
        this.storefronts.set(data.userId, sf);
        this.storefrontsBySlug.set(data.slug, sf);
        return sf;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      update: async ({ where, data }: any) => {
        const sf = this.storefronts.get(where.userId);
        if (!sf) return null;
        const updated = { ...sf, ...data, updatedAt: new Date() };
        this.storefronts.set(where.userId, updated);
        this.storefrontsBySlug.set(updated.slug, updated);
        return updated;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      delete: async ({ where }: any) => {
        const sf = this.storefronts.get(where.userId);
        if (sf) {
          this.storefronts.delete(where.userId);
          this.storefrontsBySlug.delete(sf.slug);
        }
      },
    };
  }

  get collection() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findMany: async ({ where }: any) => {
        return Array.from(this.collections.values()).filter(
          (c) => c.storefrontId === where.storefrontId,
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findFirst: async ({ where }: any) => {
        return (
          Array.from(this.collections.values()).find(
            (c) => c.id === where.id && c.storefrontId === where.storefrontId,
          ) ?? null
        );
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: async ({ data }: any) => {
        const c = {
          id: randomUUID(),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.collections.set(c.id, c);
        return c;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      update: async ({ where, data }: any) => {
        const c = this.collections.get(where.id);
        if (!c) return null;
        const updated = { ...c, ...data, updatedAt: new Date() };
        this.collections.set(where.id, updated);
        return updated;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      delete: async ({ where }: any) => {
        this.collections.delete(where.id);
      },
    };
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StorefrontsModule", () => {
  let app: INestApplication;
  let prismaMock: InMemoryPrismaService;

  const buildApp = async (userId = USER_ID) => {
    MockGuard.userId = userId;
    prismaMock = new InMemoryPrismaService();
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), StorefrontsModule],
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

  // ── Create ──

  describe("POST /storefronts", () => {
    it("creates a storefront for the authenticated seller", async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .post("/storefronts")
        .send({ name: "My Shop", slug: "my-shop", description: "Cool stuff" })
        .expect(201);

      expect(res.body.userId).toBe(USER_ID);
      expect(res.body.slug).toBe("my-shop");
      expect(res.body.name).toBe("My Shop");
    });

    it("rejects duplicate storefront for same user", async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post("/storefronts")
        .send({ name: "My Shop", slug: "my-shop" });

      await request(app.getHttpServer())
        .post("/storefronts")
        .send({ name: "Second Shop", slug: "second-shop" })
        .expect(409);
    });

    it("rejects duplicate slug", async () => {
      await buildApp(USER_ID);
      await request(app.getHttpServer())
        .post("/storefronts")
        .send({ name: "Shop A", slug: "taken-slug" });

      MockGuard.userId = OTHER_USER_ID;
      await request(app.getHttpServer())
        .post("/storefronts")
        .send({ name: "Shop B", slug: "taken-slug" })
        .expect(409);
    });
  });

  // ── Get mine ──

  describe("GET /storefronts/me", () => {
    it("returns my storefront with collections", async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post("/storefronts")
        .send({ name: "My Shop", slug: "my-shop" });

      const res = await request(app.getHttpServer())
        .get("/storefronts/me")
        .expect(200);

      expect(res.body.userId).toBe(USER_ID);
      expect(res.body.collections).toBeDefined();
    });

    it("returns empty/null when user has no storefront", async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .get("/storefronts/me")
        .expect(200);

      // NestJS doesn't serialize null as JSON null — body will be empty or falsy
      expect(res.body == null || Object.keys(res.body).length === 0).toBe(true);
    });
  });

  // ── Update ──

  describe("PATCH /storefronts/me", () => {
    it("updates storefront fields", async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post("/storefronts")
        .send({ name: "My Shop", slug: "my-shop" });

      const res = await request(app.getHttpServer())
        .patch("/storefronts/me")
        .send({ name: "Updated Shop", description: "Now with more stuff" })
        .expect(200);

      expect(res.body.name).toBe("Updated Shop");
      expect(res.body.description).toBe("Now with more stuff");
    });

    it("returns 404 when no storefront exists", async () => {
      await buildApp();
      await request(app.getHttpServer())
        .patch("/storefronts/me")
        .send({ name: "Ghost Update" })
        .expect(404);
    });
  });

  // ── Delete ──

  describe("DELETE /storefronts/me", () => {
    it("deletes the storefront", async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post("/storefronts")
        .send({ name: "My Shop", slug: "my-shop" });

      await request(app.getHttpServer()).delete("/storefronts/me").expect(204);

      expect(prismaMock.storefronts.get(USER_ID)).toBeUndefined();
    });

    it("returns 404 when nothing to delete", async () => {
      await buildApp();
      await request(app.getHttpServer()).delete("/storefronts/me").expect(404);
    });
  });

  // ── Get by slug (public) ──

  describe("GET /storefronts/:slug", () => {
    it("returns storefront by slug without auth", async () => {
      await buildApp();
      await request(app.getHttpServer())
        .post("/storefronts")
        .send({ name: "Public Shop", slug: "public-shop" });

      const res = await request(app.getHttpServer())
        .get("/storefronts/public-shop")
        .expect(200);

      expect(res.body.slug).toBe("public-shop");
    });

    it("returns 404 for unknown slug", async () => {
      await buildApp();
      await request(app.getHttpServer())
        .get("/storefronts/no-such-shop")
        .expect(404);
    });
  });

  // ── Collections ──

  describe("Collections", () => {
    let storefrontId: string;

    beforeEach(async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .post("/storefronts")
        .send({ name: "My Shop", slug: "my-shop" });
      storefrontId = res.body.id;
    });

    it("creates a collection", async () => {
      const res = await request(app.getHttpServer())
        .post("/storefronts/me/collections")
        .send({ name: "Summer Collection", slug: "summer" })
        .expect(201);

      expect(res.body.name).toBe("Summer Collection");
      expect(res.body.storefrontId).toBe(storefrontId);
    });

    it("lists collections for storefront", async () => {
      await request(app.getHttpServer())
        .post("/storefronts/me/collections")
        .send({ name: "Col A", slug: "col-a" });

      const res = await request(app.getHttpServer())
        .get("/storefronts/me/collections")
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Col A");
    });

    it("deletes a collection", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/storefronts/me/collections")
        .send({ name: "Temp Col", slug: "temp" });
      const colId = createRes.body.id;

      await request(app.getHttpServer())
        .delete(`/storefronts/me/collections/${colId}`)
        .expect(204);

      expect(prismaMock.collections.get(colId)).toBeUndefined();
    });
  });
});
