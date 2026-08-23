jest.mock("../notifications/notifications.gateway");

import { CanActivate, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { PrismaService } from "../../prisma/prisma.service";
import { EscrowModule } from "./escrow.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { NotificationsService } from "../notifications/notifications.service";

const BUYER_ID = "buyer-escrow-1";
const SELLER_ID = "seller-escrow-1";
const ADMIN_ID = "admin-escrow-1";
const ORDER_ID = "order-escrow-1";
const ORDER_ID_2 = "order-escrow-2";
const ESCROW_ID = "escrow-holding-1";
const ESCROW_ID_2 = "escrow-holding-2";
const DISPUTE_ID = "dispute-seed-1";

// ─── Guards ───────────────────────────────────────────────────────────────────

class MockGuard implements CanActivate {
  static userId = BUYER_ID;
  static role = "BUYER";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: MockGuard.userId, role: MockGuard.role };
    return true;
  }
}

class AllowAllGuard implements CanActivate {
  canActivate() {
    return true;
  }
}

// ─── In-Memory Prisma ─────────────────────────────────────────────────────────

class InMemoryPrismaService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  escrowHoldings = new Map<string, any>(); // key: orderId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  escrowHoldingsById = new Map<string, any>(); // key: id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  escrowTransactions = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  escrowDisputes = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  disputeMessages = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  orders = new Map<string, any>();

  constructor() {
    // Seed escrow in HOLDING for release/refund/dispute tests
    const holding1 = {
      id: ESCROW_ID,
      orderId: ORDER_ID,
      amountCents: 10000,
      currency: "USD",
      status: "HOLDING",
      releaseAfter: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      disputes: [],
      transactions: [],
    };
    this.escrowHoldings.set(ORDER_ID, holding1);
    this.escrowHoldingsById.set(ESCROW_ID, holding1);

    // Seed escrow in DISPUTED state for resolve tests
    const holding2 = {
      id: ESCROW_ID_2,
      orderId: ORDER_ID_2,
      amountCents: 8000,
      currency: "USD",
      status: "DISPUTED",
      releaseAfter: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      disputes: [],
      transactions: [],
    };
    this.escrowHoldings.set(ORDER_ID_2, holding2);
    this.escrowHoldingsById.set(ESCROW_ID_2, holding2);

    // Seed orders (for seller/buyer email lookup after release/refund)
    this.orders.set(ORDER_ID, {
      id: ORDER_ID,
      buyerId: BUYER_ID,
      sellerId: SELLER_ID,
      seller: { email: "seller@test.com", name: "Seller" },
      buyer: { email: "buyer@test.com", name: "Buyer" },
    });
    this.orders.set(ORDER_ID_2, {
      id: ORDER_ID_2,
      buyerId: BUYER_ID,
      sellerId: SELLER_ID,
      seller: { email: "seller@test.com", name: "Seller" },
      buyer: { email: "buyer@test.com", name: "Buyer" },
    });

    // Seed a dispute on ESCROW_ID_2 for resolve tests
    const seededDispute = {
      id: DISPUTE_ID,
      escrowId: ESCROW_ID_2,
      openedById: BUYER_ID,
      reason: "Item not received",
      status: "OPEN",
      openedAt: new Date(),
      resolution: null,
      resolvedAt: null,
      escrow: holding2,
      openedBy: { id: BUYER_ID, email: "buyer@test.com", name: "Buyer" },
      messages: [],
    };
    this.escrowDisputes.set(DISPUTE_ID, seededDispute);
  }

  get escrowHolding() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findUnique: async ({ where, include: _include }: any) => {
        const h =
          this.escrowHoldings.get(where.orderId) ??
          this.escrowHoldingsById.get(where.id);
        if (!h) return null;
        return {
          ...h,
          disputes: Array.from(this.escrowDisputes.values()).filter(
            (d) => d.escrowId === h.id,
          ),
          transactions: Array.from(this.escrowTransactions.values()).filter(
            (t) => t.escrowId === h.id,
          ),
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: async ({ data }: any) => {
        const h = { id: randomUUID(), ...data };
        this.escrowHoldings.set(data.orderId, h);
        this.escrowHoldingsById.set(h.id, h);
        return h;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      update: async ({ where, data }: any) => {
        const h =
          this.escrowHoldings.get(where.orderId) ??
          this.escrowHoldingsById.get(where.id);
        if (!h) return null;
        const updated = { ...h, ...data };
        this.escrowHoldings.set(h.orderId, updated);
        this.escrowHoldingsById.set(h.id, updated);
        return updated;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      updateMany: async ({ where, data }: any) => {
        const h = this.escrowHoldings.get(where.orderId);
        if (!h || (where.status && h.status !== where.status)) {
          return { count: 0 };
        }
        const updated = { ...h, ...data };
        this.escrowHoldings.set(h.orderId, updated);
        this.escrowHoldingsById.set(h.id, updated);
        return { count: 1 };
      },
    };
  }

  get escrowTransaction() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: async ({ data }: any) => {
        const tx = { id: randomUUID(), ...data, createdAt: new Date() };
        this.escrowTransactions.set(tx.id, tx);
        return tx;
      },
    };
  }

  get auditLog() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: async ({ data }: any) => {
        return { id: randomUUID(), ...data, createdAt: new Date() };
      },
    };
  }

  get escrowDispute() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findUnique: async ({ where, include: _include }: any) => {
        const d = this.escrowDisputes.get(where.id);
        if (!d) return null;
        return {
          ...d,
          escrow: {
            ...this.escrowHoldingsById.get(d.escrowId),
            order: this.orders.get(
              this.escrowHoldingsById.get(d.escrowId)?.orderId,
            ),
          },
          messages: Array.from(this.disputeMessages.values()).filter(
            (m) => m.disputeId === d.id,
          ),
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findMany: async ({ where }: any) => {
        return Array.from(this.escrowDisputes.values()).filter((d) => {
          if (where?.status?.in) return where.status.in.includes(d.status);
          return true;
        });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: async ({ data, include: _include }: any) => {
        const d = {
          id: randomUUID(),
          ...data,
          openedAt: new Date(),
          openedBy: {
            id: data.openedById,
            email: "user@test.com",
            name: "User",
          },
          messages: [],
        };
        this.escrowDisputes.set(d.id, d);
        return d;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      update: async ({ where, data }: any) => {
        const d = this.escrowDisputes.get(where.id);
        if (!d) return null;
        const updated = { ...d, ...data };
        this.escrowDisputes.set(where.id, updated);
        return updated;
      },
    };
  }

  get disputeMessage() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: async ({ data, include: _include }: any) => {
        const msg = {
          id: randomUUID(),
          ...data,
          createdAt: new Date(),
          author: { id: data.authorId, email: "user@test.com", name: "User" },
        };
        this.disputeMessages.set(msg.id, msg);
        return msg;
      },
    };
  }

  get order() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      findUnique: async ({ where }: any) => this.orders.get(where.id) ?? null,
    };
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("EscrowModule", () => {
  let app: INestApplication;
  let prismaMock: InMemoryPrismaService;

  const buildApp = async (userId = BUYER_ID, role = "BUYER") => {
    MockGuard.userId = userId;
    MockGuard.role = role;
    prismaMock = new InMemoryPrismaService();

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), EscrowModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(NotificationsService)
      .useValue({
        notifyEscrowReleased: jest.fn().mockResolvedValue(undefined),
        notifyEscrowRefunded: jest.fn().mockResolvedValue(undefined),
        notifyDisputeOpened: jest.fn().mockResolvedValue(undefined),
      })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockGuard)
      .overrideGuard(RolesGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  };

  afterEach(async () => await app.close());

  // ── GET /escrow/order/:orderId ──

  describe("GET /escrow/order/:orderId", () => {
    it("returns escrow details with disputes and transactions", async () => {
      await buildApp();
      const res = await request(app.getHttpServer())
        .get(`/escrow/order/${ORDER_ID}`)
        .expect(200);

      expect(res.body.orderId).toBe(ORDER_ID);
      expect(res.body.status).toBe("HOLDING");
      expect(res.body.amountCents).toBe(10000);
      expect(Array.isArray(res.body.disputes)).toBe(true);
      expect(Array.isArray(res.body.transactions)).toBe(true);
    });

    it("returns 404 for an order without escrow", async () => {
      await buildApp();
      await request(app.getHttpServer())
        .get("/escrow/order/nonexistent-order")
        .expect(404);
    });

    it("returns 403 when caller is not a party to the order", async () => {
      await buildApp("intruder-user", "BUYER");
      await request(app.getHttpServer())
        .get(`/escrow/order/${ORDER_ID}`)
        .expect(403);
    });

    it("allows admin to read escrow for any order", async () => {
      await buildApp(ADMIN_ID, "ADMIN");
      await request(app.getHttpServer())
        .get(`/escrow/order/${ORDER_ID}`)
        .expect(200);
    });
  });

  // ── POST /escrow/order/:orderId/dispute ──

  describe("POST /escrow/order/:orderId/dispute", () => {
    it("opens a dispute and transitions escrow to DISPUTED", async () => {
      await buildApp(BUYER_ID);
      const res = await request(app.getHttpServer())
        .post(`/escrow/order/${ORDER_ID}/dispute`)
        .send({ reason: "Item not as described" })
        .expect(201);

      expect(res.body.reason).toBe("Item not as described");
      expect(res.body.status).toBe("OPEN");
      // Escrow should now be DISPUTED
      expect(prismaMock.escrowHoldings.get(ORDER_ID)!.status).toBe("DISPUTED");
    });

    it("returns 400 when escrow is not in HOLDING state", async () => {
      await buildApp(BUYER_ID);
      // ORDER_ID_2 escrow is already DISPUTED
      await request(app.getHttpServer())
        .post(`/escrow/order/${ORDER_ID_2}/dispute`)
        .send({ reason: "Second dispute attempt" })
        .expect(400);
    });

    it("returns 404 when escrow does not exist", async () => {
      await buildApp(BUYER_ID);
      await request(app.getHttpServer())
        .post("/escrow/order/nonexistent/dispute")
        .send({ reason: "Issue" })
        .expect(404);
    });
  });

  // ── POST /escrow/order/:orderId/release ──

  describe("POST /escrow/order/:orderId/release", () => {
    it("releases funds and transitions escrow to RELEASED", async () => {
      await buildApp(ADMIN_ID, "ADMIN");
      const res = await request(app.getHttpServer())
        .post(`/escrow/order/${ORDER_ID}/release`)
        .send({ note: "Order completed" })
        .expect(201);

      expect(res.body.status).toBe("RELEASED");
      expect(res.body.releasedAt).toBeDefined();
    });

    it("returns 400 when escrow is already DISPUTED", async () => {
      await buildApp(ADMIN_ID, "ADMIN");
      await request(app.getHttpServer())
        .post(`/escrow/order/${ORDER_ID_2}/release`)
        .send({})
        .expect(400);
    });

    it("creates an escrow transaction record on release", async () => {
      await buildApp(ADMIN_ID, "ADMIN");
      await request(app.getHttpServer())
        .post(`/escrow/order/${ORDER_ID}/release`)
        .send({});

      const transactions = Array.from(prismaMock.escrowTransactions.values());
      expect(transactions).toHaveLength(1);
      expect(transactions[0].type).toBe("RELEASE");
      expect(transactions[0].amountCents).toBe(10000);
    });
  });

  // ── POST /escrow/order/:orderId/refund ──

  describe("POST /escrow/order/:orderId/refund", () => {
    it("refunds the full escrow amount", async () => {
      await buildApp(ADMIN_ID, "ADMIN");
      const res = await request(app.getHttpServer())
        .post(`/escrow/order/${ORDER_ID}/refund`)
        .send({})
        .expect(201);

      expect(res.body.status).toBe("REFUNDED");
    });

    it("allows a partial refund on a DISPUTED escrow", async () => {
      await buildApp(ADMIN_ID, "ADMIN");
      const res = await request(app.getHttpServer())
        .post(`/escrow/order/${ORDER_ID_2}/refund`)
        .send({ amountCents: 4000 })
        .expect(201);

      expect(res.body.status).toBe("REFUNDED");
    });

    it("returns 400 when refund amount exceeds escrow amount", async () => {
      await buildApp(ADMIN_ID, "ADMIN");
      await request(app.getHttpServer())
        .post(`/escrow/order/${ORDER_ID}/refund`)
        .send({ amountCents: 99999 })
        .expect(400);
    });
  });

  // ── POST /escrow/disputes/:disputeId/messages ──

  describe("POST /escrow/disputes/:disputeId/messages", () => {
    it("adds a message to the dispute thread", async () => {
      await buildApp(BUYER_ID);
      const res = await request(app.getHttpServer())
        .post(`/escrow/disputes/${DISPUTE_ID}/messages`)
        .send({ body: "I have proof of non-delivery." })
        .expect(201);

      expect(res.body.body).toBe("I have proof of non-delivery.");
      expect(res.body.authorId).toBe(BUYER_ID);
    });

    it("returns 404 for an unknown dispute", async () => {
      await buildApp(BUYER_ID);
      await request(app.getHttpServer())
        .post("/escrow/disputes/nonexistent/messages")
        .send({ body: "Hello" })
        .expect(404);
    });
  });

  // ── PATCH /escrow/disputes/:disputeId/resolve ──

  describe("PATCH /escrow/disputes/:disputeId/resolve", () => {
    it("resolves a dispute with REFUND action", async () => {
      await buildApp(ADMIN_ID, "ADMIN");
      const res = await request(app.getHttpServer())
        .patch(`/escrow/disputes/${DISPUTE_ID}/resolve`)
        .send({ resolution: "Buyer confirmed non-delivery", action: "REFUND" })
        .expect(200);

      expect(res.body.status).toBeDefined();
      // The dispute itself should be marked RESOLVED
      expect(prismaMock.escrowDisputes.get(DISPUTE_ID)!.status).toBe(
        "RESOLVED",
      );
    });

    it("returns 400 when dispute is already resolved", async () => {
      await buildApp(ADMIN_ID, "ADMIN");
      await request(app.getHttpServer())
        .patch(`/escrow/disputes/${DISPUTE_ID}/resolve`)
        .send({ resolution: "Done", action: "REFUND" });

      await request(app.getHttpServer())
        .patch(`/escrow/disputes/${DISPUTE_ID}/resolve`)
        .send({ resolution: "Done again", action: "REFUND" })
        .expect(400);
    });

    it("returns 404 for an unknown dispute", async () => {
      await buildApp(ADMIN_ID, "ADMIN");
      await request(app.getHttpServer())
        .patch("/escrow/disputes/nonexistent/resolve")
        .send({ resolution: "N/A", action: "REFUND" })
        .expect(404);
    });
  });

  // ── GET /escrow/disputes ──

  describe("GET /escrow/disputes", () => {
    it("returns active (OPEN/UNDER_REVIEW) disputes for admin", async () => {
      await buildApp(ADMIN_ID, "ADMIN");
      const res = await request(app.getHttpServer())
        .get("/escrow/disputes")
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // The seeded dispute is OPEN
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].status).toBe("OPEN");
    });
  });
});
