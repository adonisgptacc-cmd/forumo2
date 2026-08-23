import { CanActivate, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import {
  EscrowStatus,
  EscrowTransactionType,
  Listing,
  ListingStatus,
  Order,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { PrismaService } from "../../prisma/prisma.service";
import { OrdersModule } from "./orders.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

const BUYER_ID = "buyer-1";
const SELLER_ID = "seller-1";
const ADMIN_ID = "admin-1";
const LISTING_ID = "listing-1";
const STOCKED_LISTING_ID = "listing-stocked";
const STOCKED_VARIANT_ID = "variant-stocked";
const PAUSED_LISTING_ID = "listing-paused";
const CANCELLED_ORDER_NUMBER = "ORD-SEEDED-CANCELLED";

class MockGuard implements CanActivate {
  static currentId = BUYER_ID;
  static currentRole = "BUYER";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: MockGuard.currentId, role: MockGuard.currentRole };
    return true;
  }
}

describe("OrdersModule flows", () => {
  let app: INestApplication;
  let prismaMock: InMemoryPrismaService;

  beforeEach(async () => {
    MockGuard.currentId = BUYER_ID;
    MockGuard.currentRole = "BUYER";
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.GOOGLE_CLIENT_ID = "test-google-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.PAYSTACK_SECRET_KEY;

    prismaMock = new InMemoryPrismaService();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        OrdersModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideGuard(JwtAuthGuard)
      .useClass(MockGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      try {
        await app.close();
      } catch (err) {
        // Silently handle close errors in tests
        console.debug(
          "App close error (expected in tests):",
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  });

  it("returns seeded paid/cancelled/refunded orders", async () => {
    const res = await request(app.getHttpServer()).get("/orders").expect(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    const numbers = res.body.map((order: any) => order.orderNumber);

    expect(numbers).toContain("ORD-SEEDED-PAID");
    expect(numbers).toContain("ORD-SEEDED-REFUNDED");
    expect(numbers).toContain(CANCELLED_ORDER_NUMBER);
  });

  it("runs the pay → fulfill → release happy path", async () => {
    const orderPayload = {
      buyerId: BUYER_ID,
      sellerId: SELLER_ID,
      items: [{ listingId: LISTING_ID, quantity: 1 }],
      shippingCents: 500,
      feeCents: 250,
    };

    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send(orderPayload)
      .expect(201);
    const orderId = createRes.body.id;
    expect(createRes.body.payments[0].providerStatus).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.PAID, providerStatus: "succeeded" })
      .expect(200);

    const paidRes = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .expect(200);
    expect(paidRes.body.status).toBe(OrderStatus.PAID);
    expect(paidRes.body.paymentStatus).toBe(PaymentStatus.CAPTURED);
    expect(paidRes.body.escrow.status).toBe(EscrowStatus.HOLDING);

    MockGuard.currentId = SELLER_ID;
    MockGuard.currentRole = "SELLER";
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.FULFILLED })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.DELIVERED })
      .expect(200);
    MockGuard.currentId = BUYER_ID;
    MockGuard.currentRole = "BUYER";

    const releaseRes = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.COMPLETED })
      .expect(200);

    expect(releaseRes.body.escrow.status).toBe(EscrowStatus.RELEASED);
    expect(releaseRes.body.escrow.transactions[0].type).toBe(
      EscrowTransactionType.RELEASE,
    );
    expect(prismaMock.auditLogs).toHaveLength(1);
  });

  describe("POST /orders/:id/confirm-delivery", () => {
    it("rejects when the caller is not the buyer", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/orders")
        .send({
          buyerId: BUYER_ID,
          sellerId: SELLER_ID,
          items: [{ listingId: LISTING_ID, quantity: 1 }],
          shippingCents: 500,
          feeCents: 250,
        })
        .expect(201);
      const orderId = createRes.body.id;

      MockGuard.currentId = "someone-else";
      MockGuard.currentRole = "BUYER";
      await request(app.getHttpServer())
        .post(`/orders/${orderId}/confirm-delivery`)
        .expect(403);
    });

    it("rejects when the order has not shipped yet", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/orders")
        .send({
          buyerId: BUYER_ID,
          sellerId: SELLER_ID,
          items: [{ listingId: LISTING_ID, quantity: 1 }],
          shippingCents: 500,
          feeCents: 250,
        })
        .expect(201);
      const orderId = createRes.body.id;
      // Order is PENDING immediately after creation — confirm-delivery
      // must reject before FULFILLED.
      await request(app.getHttpServer())
        .post(`/orders/${orderId}/confirm-delivery`)
        .expect(400);
    });

    it("starts the release countdown and marks the order DELIVERED on success", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/orders")
        .send({
          buyerId: BUYER_ID,
          sellerId: SELLER_ID,
          items: [{ listingId: LISTING_ID, quantity: 1 }],
          shippingCents: 500,
          feeCents: 250,
        })
        .expect(201);
      const orderId = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .send({ status: OrderStatus.PAID, providerStatus: "succeeded" })
        .expect(200);

      MockGuard.currentId = SELLER_ID;
      MockGuard.currentRole = "SELLER";
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .send({ status: OrderStatus.FULFILLED })
        .expect(200);

      MockGuard.currentId = BUYER_ID;
      MockGuard.currentRole = "BUYER";
      const confirmRes = await request(app.getHttpServer())
        .post(`/orders/${orderId}/confirm-delivery`)
        .expect(200);

      expect(confirmRes.body.status).toBe(OrderStatus.DELIVERED);

      const escrow = await prismaMock.escrowHolding.findUnique({
        where: { orderId },
      });
      expect(escrow?.releaseAfter).not.toBeNull();
    });
  });

  it("cancels and refunds via webhook + cancellation", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: LISTING_ID }],
      })
      .expect(201);

    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .post("/orders/payments/stripe/webhook")
      .send({
        type: "payment_intent.succeeded",
        data: { object: { metadata: { orderId }, status: "succeeded" } },
      })
      .expect(200);

    const paidRes = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .expect(200);
    expect(paidRes.body.status).toBe(OrderStatus.PAID);

    MockGuard.currentId = ADMIN_ID;
    MockGuard.currentRole = "ADMIN";
    const cancelRes = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.CANCELLED, providerStatus: "canceled" })
      .expect(200);

    expect(cancelRes.body.paymentStatus).toBe(PaymentStatus.REFUNDED);
    expect(cancelRes.body.escrow.status).toBe(EscrowStatus.REFUNDED);
    expect(cancelRes.body.escrow.transactions[0].type).toBe(
      EscrowTransactionType.REFUND,
    );

    // Check if any audit log matches the expected action, since webhook received might come first
    const refundLog = prismaMock.auditLogs.find(
      (log) => log.action === "order.escrow.refund",
    );
    expect(refundLog).toBeDefined();
    expect(refundLog?.entityId).toBe(orderId);
  });

  it("captures provider statuses from Stripe webhook callbacks", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: LISTING_ID }],
      })
      .expect(201);

    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .post("/orders/payments/stripe/webhook")
      .send({
        type: "payment_intent.succeeded",
        data: { object: { metadata: { orderId }, status: "requires_capture" } },
      })
      .expect(200);

    const refreshed = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .expect(200);
    expect(refreshed.body.payments[0].providerStatus).toBe("requires_capture");
    expect(refreshed.body.timeline.at(-1)?.status).toBe(OrderStatus.PAID);
  });

  it("releases escrow via controller shortcut", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: LISTING_ID }],
      })
      .expect(201);
    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.PAID })
      .expect(200);

    MockGuard.currentId = SELLER_ID;
    MockGuard.currentRole = "SELLER";
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.FULFILLED })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.DELIVERED })
      .expect(200);
    MockGuard.currentId = BUYER_ID;
    MockGuard.currentRole = "BUYER";

    const releaseRes = await request(app.getHttpServer())
      .post(`/orders/${orderId}/release`)
      .send({ note: "Buyer confirmed", actorId: BUYER_ID })
      .expect(200);

    expect(releaseRes.body.status).toBe(OrderStatus.COMPLETED);
    expect(releaseRes.body.escrow.status).toBe(EscrowStatus.RELEASED);
    expect(releaseRes.body.timeline.at(-1)?.note).toBe("Buyer confirmed");
  });

  it("refunds escrow via controller shortcut", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: LISTING_ID }],
        shippingCents: 250,
      })
      .expect(201);
    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.PAID })
      .expect(200);

    MockGuard.currentId = SELLER_ID;
    MockGuard.currentRole = "ADMIN";
    const refundRes = await request(app.getHttpServer())
      .post(`/orders/${orderId}/refund`)
      .send({ providerStatus: "canceled", actorId: SELLER_ID })
      .expect(200);
    MockGuard.currentId = BUYER_ID;
    MockGuard.currentRole = "BUYER";

    expect(refundRes.body.status).toBe(OrderStatus.REFUNDED);
    expect(refundRes.body.paymentStatus).toBe(PaymentStatus.REFUNDED);
    expect(refundRes.body.timeline.at(-1)?.status).toBe(OrderStatus.REFUNDED);
    expect(refundRes.body.escrow.transactions.at(-1)?.type).toBe(
      EscrowTransactionType.REFUND,
    );
  });

  it("rejects invalid status jumps (PENDING → DELIVERED)", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: LISTING_ID }],
      })
      .expect(201);
    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.DELIVERED })
      .expect(400);
  });

  it("rejects completing an order that is not delivered", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: LISTING_ID }],
      })
      .expect(201);
    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.COMPLETED })
      .expect(400);
  });

  it("locks terminal states — cannot complete an already-refunded order (double extraction)", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: LISTING_ID }],
      })
      .expect(201);
    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.PAID })
      .expect(200);

    MockGuard.currentId = ADMIN_ID;
    MockGuard.currentRole = "ADMIN";
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.REFUNDED })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.COMPLETED })
      .expect(400);

    MockGuard.currentId = BUYER_ID;
    MockGuard.currentRole = "BUYER";
    const after = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .expect(200);
    expect(after.body.status).toBe(OrderStatus.REFUNDED);
    expect(after.body.escrow.status).toBe(EscrowStatus.REFUNDED);
  });

  it("locks terminal states — cannot refund a completed order (double refund)", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: LISTING_ID }],
      })
      .expect(201);
    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.PAID })
      .expect(200);
    MockGuard.currentId = SELLER_ID;
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.FULFILLED })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.DELIVERED })
      .expect(200);
    MockGuard.currentId = BUYER_ID;
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.COMPLETED })
      .expect(200);

    MockGuard.currentId = ADMIN_ID;
    MockGuard.currentRole = "ADMIN";
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.REFUNDED })
      .expect(400);

    MockGuard.currentId = BUYER_ID;
    MockGuard.currentRole = "BUYER";
    const after = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .expect(200);
    expect(after.body.status).toBe(OrderStatus.COMPLETED);
    expect(after.body.escrow.status).toBe(EscrowStatus.RELEASED);
  });

  it("cannot release escrow while the order is disputed", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: LISTING_ID }],
      })
      .expect(201);
    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.PAID })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.DISPUTED })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.COMPLETED })
      .expect(400);

    const after = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .expect(200);
    expect(after.body.status).toBe(OrderStatus.DISPUTED);
  });

  describe("POST /orders/:id/release with an open dispute", () => {
    it("rejects release when the escrow is DISPUTED (400)", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/orders")
        .send({
          buyerId: BUYER_ID,
          sellerId: SELLER_ID,
          items: [{ listingId: LISTING_ID, quantity: 1 }],
          shippingCents: 500,
          feeCents: 250,
        })
        .expect(201);
      const orderId = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .send({ status: OrderStatus.PAID, providerStatus: "succeeded" })
        .expect(200);

      MockGuard.currentId = SELLER_ID;
      MockGuard.currentRole = "SELLER";
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .send({ status: OrderStatus.FULFILLED })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .send({ status: OrderStatus.DELIVERED })
        .expect(200);

      // Simulate an open dispute the way EscrowService.openDispute() does —
      // set the escrow's own status to DISPUTED.
      await prismaMock.escrowHolding.updateMany({
        where: { orderId, status: "HOLDING" },
        data: { status: "DISPUTED" },
      });

      MockGuard.currentId = BUYER_ID;
      MockGuard.currentRole = "BUYER";
      await request(app.getHttpServer())
        .post(`/orders/${orderId}/release`)
        .expect(400);

      const escrow = await prismaMock.escrowHolding.findUnique({
        where: { orderId },
      });
      expect(escrow?.status).toBe("DISPUTED");
    });
  });

  it("does not double-refund when cancellation is retried", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: LISTING_ID }],
      })
      .expect(201);
    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.PAID })
      .expect(200);

    MockGuard.currentId = ADMIN_ID;
    MockGuard.currentRole = "ADMIN";
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.CANCELLED })
      .expect(200);

    // Retry is an idempotent no-op: 200, but no second refund side effects.
    const retryRes = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.CANCELLED })
      .expect(200);

    expect(retryRes.body.status).toBe(OrderStatus.REFUNDED);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    const refundTxns = (retryRes.body.escrow.transactions as any[]).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      (t: any) => t.type === EscrowTransactionType.REFUND,
    );
    expect(refundTxns).toHaveLength(1);
  });

  it("admin can force a status override that skips intermediate states", async () => {
    MockGuard.currentId = ADMIN_ID;
    MockGuard.currentRole = "ADMIN";
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: LISTING_ID }],
      })
      .expect(201);
    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.PAID })
      .expect(200);

    const res = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.DELIVERED })
      .expect(200);

    expect(res.body.status).toBe(OrderStatus.DELIVERED);
  });

  it("admin cannot force a refund on an order whose escrow was already released", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: LISTING_ID }],
      })
      .expect(201);
    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.PAID })
      .expect(200);
    MockGuard.currentId = SELLER_ID;
    MockGuard.currentRole = "SELLER";
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.FULFILLED })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.DELIVERED })
      .expect(200);
    MockGuard.currentId = BUYER_ID;
    MockGuard.currentRole = "BUYER";
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.COMPLETED })
      .expect(200);

    MockGuard.currentId = ADMIN_ID;
    MockGuard.currentRole = "ADMIN";
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: OrderStatus.REFUNDED })
      .expect(400);

    MockGuard.currentId = BUYER_ID;
    MockGuard.currentRole = "BUYER";
    const after = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .expect(200);
    expect(after.body.status).toBe(OrderStatus.COMPLETED);
  });

  it("does not mark a failed payment as refunded", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: LISTING_ID }],
      })
      .expect(201);
    const orderId = createRes.body.id;

    await request(app.getHttpServer())
      .post("/orders/payments/stripe/webhook")
      .send({
        type: "payment_intent.payment_failed",
        data: {
          object: { metadata: { orderId }, status: "requires_payment_method" },
        },
      })
      .expect(200);

    const refreshed = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .expect(200);
    expect(refreshed.body.status).toBe(OrderStatus.PENDING);
    expect(refreshed.body.payments[0].status).toBe(PaymentStatus.FAILED);
  });

  it("rejects creating an order for a non-PUBLISHED listing", async () => {
    await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [{ listingId: PAUSED_LISTING_ID }],
      })
      .expect(400);

    expect(prismaMock.getListingStatus(PAUSED_LISTING_ID)).toBe(
      ListingStatus.PAUSED,
    );
  });

  it("decrements variant inventory and de-lists the listing when sold out", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [
          {
            listingId: STOCKED_LISTING_ID,
            variantId: STOCKED_VARIANT_ID,
            quantity: 2,
          },
        ],
      })
      .expect(201);
    const orderId = createRes.body.id;
    expect(orderId).toBeDefined();

    expect(prismaMock.getVariantInventory(STOCKED_VARIANT_ID)).toBe(0);
    expect(prismaMock.getListingStatus(STOCKED_LISTING_ID)).toBe(
      ListingStatus.PAUSED,
    );
  });

  it("rejects a quantity above available stock without mutating inventory", async () => {
    await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [
          {
            listingId: STOCKED_LISTING_ID,
            variantId: STOCKED_VARIANT_ID,
            quantity: 3,
          },
        ],
      })
      .expect(400);

    expect(prismaMock.getVariantInventory(STOCKED_VARIANT_ID)).toBe(2);
    expect(prismaMock.getListingStatus(STOCKED_LISTING_ID)).toBe(
      ListingStatus.PUBLISHED,
    );
  });

  it("blocks overselling when stock is exhausted by a prior order", async () => {
    await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [
          {
            listingId: STOCKED_LISTING_ID,
            variantId: STOCKED_VARIANT_ID,
            quantity: 2,
          },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/orders")
      .send({
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
        items: [
          {
            listingId: STOCKED_LISTING_ID,
            variantId: STOCKED_VARIANT_ID,
            quantity: 1,
          },
        ],
      })
      .expect(400);

    expect(prismaMock.getVariantInventory(STOCKED_VARIANT_ID)).toBe(0);
  });
});

class InMemoryPrismaService {
  private users = new Map<string, UserRecord>();
  private listings = new Map<string, ListingRecord>();
  private orders = new Map<string, OrderRecord>();
  private items = new Map<string, OrderItemRecord>();
  private timelines = new Map<string, OrderTimelineRecord[]>();
  private payments = new Map<string, PaymentTransactionRecord[]>();
  private escrows = new Map<string, EscrowHoldingRecord>();
  private escrowTransactions = new Map<string, EscrowTransactionRecord[]>();
  private auditLogStore: AuditLogRecord[] = [];

  constructor() {
    this.users.set(BUYER_ID, { id: BUYER_ID, deletedAt: null, role: "BUYER" });
    this.users.set(SELLER_ID, {
      id: SELLER_ID,
      deletedAt: null,
      role: "SELLER",
    });
    this.users.set(ADMIN_ID, { id: ADMIN_ID, deletedAt: null, role: "ADMIN" });
    this.listings.set(LISTING_ID, {
      id: LISTING_ID,
      sellerId: SELLER_ID,
      title: "Sample listing",
      priceCents: 1000,
      currency: "USD",
      status: ListingStatus.PUBLISHED,
      variants: [],
    });
    this.listings.set(STOCKED_LISTING_ID, {
      id: STOCKED_LISTING_ID,
      sellerId: SELLER_ID,
      title: "Stocked listing",
      priceCents: 2000,
      currency: "USD",
      status: ListingStatus.PUBLISHED,
      variants: [
        {
          id: STOCKED_VARIANT_ID,
          label: "Default",
          priceCents: 2000,
          currency: "USD",
          inventoryCount: 2,
        },
      ],
    });
    this.listings.set(PAUSED_LISTING_ID, {
      id: PAUSED_LISTING_ID,
      sellerId: SELLER_ID,
      title: "Paused listing",
      priceCents: 1500,
      currency: "USD",
      status: ListingStatus.PAUSED,
      variants: [],
    });

    const now = new Date();
    const paidOrderId = randomUUID();
    const refundedOrderId = randomUUID();
    const cancelledOrderId = randomUUID();

    const paidOrder: OrderRecord = {
      id: paidOrderId,
      orderNumber: "ORD-SEEDED-PAID",
      buyerId: BUYER_ID,
      sellerId: SELLER_ID,
      status: OrderStatus.PAID,
      paymentStatus: PaymentStatus.CAPTURED,
      totalItemCents: 1000,
      shippingCents: 200,
      feeCents: 50,
      currency: "USD",
      shippingAddressId: null,
      billingAddressId: null,
      metadata: null,
      placedAt: now,
      paidAt: now,
      fulfilledAt: null,
      deliveredAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.orders.set(paidOrderId, paidOrder);
    this.createOrderItem(paidOrderId, {
      listingId: LISTING_ID,
      listingTitle: "Sample listing",
      quantity: 1,
      unitPriceCents: 1000,
      currency: "USD",
      variantId: null,
      variantLabel: null,
    });
    this.timelines.set(paidOrderId, [
      this.createTimelineRecord(paidOrderId, {
        status: OrderStatus.PENDING,
        note: "Seeded order",
      }),
      this.createTimelineRecord(paidOrderId, {
        status: OrderStatus.PAID,
        note: "Seeded payment",
      }),
    ]);
    this.payments.set(paidOrderId, [
      {
        id: randomUUID(),
        orderId: paidOrderId,
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.CAPTURED,
        providerStatus: "succeeded",
        amountCents: 1250,
        currency: "USD",
        providerRef: "pi_seeded_paid",
        metadata: null,
        processedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const paidEscrow: EscrowHoldingRecord = {
      id: randomUUID(),
      orderId: paidOrderId,
      status: EscrowStatus.HOLDING,
      amountCents: 1250,
      currency: "USD",
      releaseAfter: null,
      releasedAt: null,
      metadata: null,
    };
    this.escrows.set(paidOrderId, paidEscrow);
    this.escrowTransactions.set(paidEscrow.id, []);

    const refundedOrder: OrderRecord = {
      id: refundedOrderId,
      orderNumber: "ORD-SEEDED-REFUNDED",
      buyerId: BUYER_ID,
      sellerId: SELLER_ID,
      status: OrderStatus.REFUNDED,
      paymentStatus: PaymentStatus.REFUNDED,
      totalItemCents: 1000,
      shippingCents: 0,
      feeCents: 0,
      currency: "USD",
      shippingAddressId: null,
      billingAddressId: null,
      metadata: null,
      placedAt: now,
      paidAt: now,
      fulfilledAt: null,
      deliveredAt: null,
      cancelledAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(refundedOrderId, refundedOrder);
    this.createOrderItem(refundedOrderId, {
      listingId: LISTING_ID,
      listingTitle: "Sample listing",
      quantity: 1,
      unitPriceCents: 1000,
      currency: "USD",
      variantId: null,
      variantLabel: null,
    });
    this.timelines.set(refundedOrderId, [
      this.createTimelineRecord(refundedOrderId, {
        status: OrderStatus.PAID,
        note: "Seeded payment",
      }),
      this.createTimelineRecord(refundedOrderId, {
        status: OrderStatus.REFUNDED,
        note: "Seeded refund",
      }),
    ]);
    this.payments.set(refundedOrderId, [
      {
        id: randomUUID(),
        orderId: refundedOrderId,
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.REFUNDED,
        providerStatus: "canceled",
        amountCents: 1000,
        currency: "USD",
        providerRef: "pi_seeded_refund",
        metadata: null,
        processedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const refundEscrow: EscrowHoldingRecord = {
      id: randomUUID(),
      orderId: refundedOrderId,
      status: EscrowStatus.REFUNDED,
      amountCents: 1000,
      currency: "USD",
      releaseAfter: null,
      releasedAt: now,
      metadata: null,
    };
    this.escrows.set(refundedOrderId, refundEscrow);
    this.escrowTransactions.set(refundEscrow.id, [
      {
        id: randomUUID(),
        escrowId: refundEscrow.id,
        type: EscrowTransactionType.REFUND,
        amountCents: 1000,
        currency: "USD",
        note: "Seeded refund",
        actorId: null,
        createdAt: now,
      },
    ]);

    const cancelledOrder: OrderRecord = {
      id: cancelledOrderId,
      orderNumber: CANCELLED_ORDER_NUMBER,
      buyerId: BUYER_ID,
      sellerId: SELLER_ID,
      status: OrderStatus.CANCELLED,
      paymentStatus: PaymentStatus.REFUNDED,
      totalItemCents: 800,
      shippingCents: 150,
      feeCents: 0,
      currency: "USD",
      shippingAddressId: null,
      billingAddressId: null,
      metadata: null,
      placedAt: now,
      paidAt: now,
      fulfilledAt: null,
      deliveredAt: null,
      cancelledAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(cancelledOrderId, cancelledOrder);
    this.createOrderItem(cancelledOrderId, {
      listingId: LISTING_ID,
      listingTitle: "Sample listing",
      quantity: 1,
      unitPriceCents: 800,
      currency: "USD",
      variantId: null,
      variantLabel: null,
    });
    this.timelines.set(cancelledOrderId, [
      this.createTimelineRecord(cancelledOrderId, {
        status: OrderStatus.PENDING,
        note: "Seeded order",
      }),
      this.createTimelineRecord(cancelledOrderId, {
        status: OrderStatus.CANCELLED,
        note: "Seeded cancellation",
      }),
    ]);
    this.payments.set(cancelledOrderId, [
      {
        id: randomUUID(),
        orderId: cancelledOrderId,
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.REFUNDED,
        providerStatus: "canceled",
        amountCents: 950,
        currency: "USD",
        providerRef: "pi_seeded_cancelled",
        metadata: null,
        processedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const cancelledEscrow: EscrowHoldingRecord = {
      id: randomUUID(),
      orderId: cancelledOrderId,
      status: EscrowStatus.REFUNDED,
      amountCents: 950,
      currency: "USD",
      releaseAfter: null,
      releasedAt: now,
      metadata: null,
    };
    this.escrows.set(cancelledOrderId, cancelledEscrow);
    this.escrowTransactions.set(cancelledEscrow.id, [
      {
        id: randomUUID(),
        escrowId: cancelledEscrow.id,
        type: EscrowTransactionType.REFUND,
        amountCents: 950,
        currency: "USD",
        note: "Seeded cancellation refund",
        actorId: null,
        createdAt: now,
      },
    ]);
  }

  get auditLogs(): AuditLogRecord[] {
    return this.auditLogStore;
  }

  getListingStatus(listingId: string): ListingStatus | undefined {
    return this.listings.get(listingId)?.status;
  }

  getVariantInventory(variantId: string): number | undefined {
    for (const record of this.listings.values()) {
      const variant = record.variants.find((v) => v.id === variantId);
      if (variant) return variant.inventoryCount;
    }
    return undefined;
  }

  async $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T> {
    return fn(this);
  }

  user = {
    findFirst: async ({
      where,
    }: {
      where: { id: string; deletedAt: null };
    }) => {
      const record = this.users.get(where.id);
      return record && record.deletedAt === null ? record : null;
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      return this.users.get(where.id) ?? null;
    },
  };

  listing = {
    findMany: async ({
      where,
    }: {
      where: { id: { in: string[] }; deletedAt: null };
    }) => {
      return where.id.in
        .map((id) => this.listings.get(id))
        .filter((value): value is ListingRecord => Boolean(value));
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { status: ListingStatus };
    }) => {
      const record = this.listings.get(where.id);
      if (!record) throw new Error("Listing not found");
      record.status = data.status ?? record.status;
      return record;
    },
  };

  listingVariant = {
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; inventoryCount?: { gte?: number } };
      data: { inventoryCount: { decrement: number } };
    }) => {
      let updated = 0;
      for (const record of this.listings.values()) {
        const variant = record.variants.find((v) => v.id === where.id);
        if (!variant) continue;
        const gte = where.inventoryCount?.gte ?? 0;
        if (variant.inventoryCount < gte) {
          return { count: 0 };
        }
        variant.inventoryCount -= data.inventoryCount.decrement;
        updated += 1;
      }
      return { count: updated };
    },
  };

  order = {
    findMany: async ({ include }: { include: Prisma.OrderInclude }) => {
      return Array.from(this.orders.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((order) => this.buildOrder(order, include));
    },
    findFirst: async ({
      where,
      include,
    }: {
      where: { id?: string };
      include: Prisma.OrderInclude;
    }) => {
      const order = where.id ? this.orders.get(where.id) : undefined;
      return order ? this.buildOrder(order, include) : null;
    },
    findUnique: async ({
      where,
      include,
    }: {
      where: { id: string };
      include: Prisma.OrderInclude;
    }) => {
      const order = this.orders.get(where.id);
      return order ? this.buildOrder(order, include) : null;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    create: async ({ data }: { data: any }) => {
      const id = randomUUID();
      const now = new Date();
      const record: OrderRecord = {
        id,
        orderNumber: data.orderNumber!,
        buyerId: data.buyerId!,
        sellerId: data.sellerId!,
        status: data.status ?? OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        totalItemCents: data.totalItemCents!,
        shippingCents: data.shippingCents as number,
        feeCents: data.feeCents as number,
        currency: data.currency!,
        shippingAddressId: (data.shippingAddressId as string | null) ?? null,
        billingAddressId: (data.billingAddressId as string | null) ?? null,
        metadata: (data.metadata as Prisma.JsonValue | null) ?? null,
        placedAt: data.placedAt as Date,
        paidAt: null,
        fulfilledAt: null,
        deliveredAt: null,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.orders.set(id, record);
      if (data.items?.create) {
        const createdItems = Array.isArray(data.items.create)
          ? data.items.create
          : [data.items.create];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        createdItems.forEach((item: any) => this.createOrderItem(id, item));
      }
      if (data.timeline?.create) {
        const events = Array.isArray(data.timeline.create)
          ? data.timeline.create
          : [data.timeline.create];
        this.timelines.set(
          id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
          events.map((event: any) => this.createTimelineRecord(id, event)),
        );
      }
      return record;
    },
    update: async ({
      where,
      data,
      include,
    }: {
      where: { id: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      data: any;
      include: Prisma.OrderInclude;
    }) => {
      const record = this.orders.get(where.id);
      if (!record) {
        throw new Error("Order not found");
      }
      Object.assign(record, {
        status: data.status ?? record.status,
        paymentStatus: data.paymentStatus ?? record.paymentStatus,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        paidAt: (data as any).paidAt ?? record.paidAt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        fulfilledAt: (data as any).fulfilledAt ?? record.fulfilledAt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        deliveredAt: (data as any).deliveredAt ?? record.deliveredAt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        cancelledAt: (data as any).cancelledAt ?? record.cancelledAt,
      });
      record.updatedAt = new Date();
      if (data.timeline?.create) {
        const existing = this.timelines.get(record.id) ?? [];
        const events = Array.isArray(data.timeline.create)
          ? data.timeline.create
          : [data.timeline.create];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        events.forEach((event: any) =>
          existing.push(this.createTimelineRecord(record.id, event)),
        );
        this.timelines.set(record.id, existing);
      }
      return this.buildOrder(record, include);
    },
  };

  paymentTransaction = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    create: async ({ data }: { data: any }) => {
      const record: PaymentTransactionRecord = {
        id: randomUUID(),
        orderId: data.orderId,
        provider: data.provider ?? PaymentProvider.STRIPE,
        status: data.status ?? PaymentStatus.PENDING,
        providerStatus: data.providerStatus ?? null,
        amountCents: data.amountCents,
        currency: data.currency ?? "USD",
        providerRef: data.providerRef ?? null,
        metadata: (data.metadata as Prisma.JsonValue | null) ?? null,
        processedAt: (data.processedAt as Date) ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const list = this.payments.get(data.orderId) ?? [];
      list.push(record);
      this.payments.set(data.orderId, list);
      return record;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { orderId: string };
      data: Prisma.PaymentTransactionUpdateManyMutationInput;
    }) => {
      const records = this.payments.get(where.orderId) ?? [];
      records.forEach((record) => {
        record.status = (data.status as PaymentStatus) ?? record.status;
        record.providerStatus =
          (data.providerStatus as string) ?? record.providerStatus;
        record.processedAt = (data.processedAt as Date) ?? record.processedAt;
        record.updatedAt = new Date();
      });
      this.payments.set(where.orderId, records);
      return { count: records.length };
    },
    findFirst: async ({ where }: { where: { orderId: string } }) => {
      const records = this.payments.get(where.orderId) ?? [];
      return records[0] ?? null;
    },
  };

  return = {
    updateMany: async () => ({ count: 0 }),
  };

  escrowHolding = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    create: async ({ data }: { data: any }) => {
      const record: EscrowHoldingRecord = {
        id: randomUUID(),
        orderId: data.orderId,
        status: data.status ?? EscrowStatus.HOLDING,
        amountCents: data.amountCents,
        currency: data.currency ?? "USD",
        releaseAfter: null,
        releasedAt: null,
        metadata: null,
      };
      this.escrows.set(data.orderId, record);
      return record;
    },
    findUnique: async ({
      where,
    }: {
      where: { orderId?: string; id?: string };
    }) => {
      if (where.orderId) {
        return this.escrows.get(where.orderId) ?? null;
      }
      const record = Array.from(this.escrows.values()).find(
        (escrow) => escrow.id === where.id,
      );
      return record ?? null;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const record = Array.from(this.escrows.values()).find(
        (escrow) => escrow.id === where.id,
      );
      if (!record) {
        throw new Error("Escrow not found");
      }
      record.status = (data.status as EscrowStatus) ?? record.status;
      record.releasedAt = (data.releasedAt as Date) ?? record.releasedAt;
      return record;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: {
        orderId: string;
        status?: EscrowStatus | { in: EscrowStatus[] };
        releaseAfter?: Date | null;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      data: any;
    }) => {
      const record = this.escrows.get(where.orderId);
      if (!record) {
        return { count: 0 };
      }
      const statusAllowed =
        where.status == null ||
        (typeof where.status === "object" &&
          where.status.in.includes(record.status)) ||
        where.status === record.status;
      const releaseAfterAllowed =
        where.releaseAfter === undefined ||
        record.releaseAfter === where.releaseAfter;
      if (!statusAllowed || !releaseAfterAllowed) {
        return { count: 0 };
      }
      record.status = (data.status as EscrowStatus) ?? record.status;
      record.releasedAt = (data.releasedAt as Date) ?? record.releasedAt;
      record.releaseAfter =
        (data.releaseAfter as Date | null | undefined) ?? record.releaseAfter;
      return { count: 1 };
    },
  };

  escrowTransaction = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    create: async ({ data }: { data: any }) => {
      const record: EscrowTransactionRecord = {
        id: randomUUID(),
        escrowId: data.escrowId,
        type: data.type as EscrowTransactionType,
        amountCents: data.amountCents,
        currency: data.currency ?? "USD",
        note: data.note ?? null,
        actorId: data.actorId ?? null,
        createdAt: new Date(),
      };
      const list = this.escrowTransactions.get(data.escrowId) ?? [];
      list.push(record);
      this.escrowTransactions.set(data.escrowId, list);
      return record;
    },
  };

  auditLog = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    create: async ({ data }: { data: any }) => {
      const record: AuditLogRecord = {
        id: randomUUID(),
        actorId: data.actorId ?? null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ?? null,
        payload: (data.payload as Prisma.JsonValue | null) ?? null,
      };
      this.auditLogStore.push(record);
      return record;
    },
  };

  listingCategoryAssignment = {
    findFirst: async () => null,
  };

  feeSchedule = {
    findFirst: async () => null,
  };

  webhookEvent = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    create: async ({ data }: { data: any }) => {
      return { id: randomUUID(), ...data };
    },
    update: async () => ({}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  private createOrderItem(orderId: string, item: any) {
    const id = randomUUID();
    this.items.set(id, {
      id,
      orderId,
      listingId: item.listingId!,
      listingTitle: item.listingTitle!,
      variantId: (item.variantId as string | null) ?? null,
      variantLabel: item.variantLabel ?? null,
      quantity: item.quantity!,
      unitPriceCents: item.unitPriceCents!,
      currency: item.currency!,
    });
  }

  private createTimelineRecord(
    orderId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    event: any,
  ): OrderTimelineRecord {
    return {
      id: randomUUID(),
      orderId,
      status: event.status as OrderStatus,
      note: event.note ?? null,
      actorId: event.actorId ?? null,
      metadata: (event.metadata as Prisma.JsonValue | null) ?? null,
      createdAt: new Date(),
    };
  }

  private buildOrder(
    record: OrderRecord,
    include: Prisma.OrderInclude | undefined,
  ) {
    return {
      ...record,
      items: include?.items ? this.getItems(record.id) : undefined,
      shipments: [],
      timeline: include?.timeline ? this.getTimeline(record.id) : undefined,
      payments: include?.payments ? this.getPayments(record.id) : undefined,
      escrow: include?.escrow ? this.getEscrow(record.id) : null,
    };
  }

  private getItems(orderId: string) {
    return Array.from(this.items.values()).filter(
      (item) => item.orderId === orderId,
    );
  }

  private getTimeline(orderId: string) {
    return (this.timelines.get(orderId) ?? []).slice();
  }

  private getPayments(orderId: string) {
    return (this.payments.get(orderId) ?? []).slice();
  }

  private getEscrow(orderId: string) {
    const escrow = this.escrows.get(orderId) ?? null;
    if (!escrow) {
      return null;
    }
    return {
      ...escrow,
      disputes: [],
      transactions: (this.escrowTransactions.get(escrow.id) ?? []).slice(),
    };
  }
}

type ListingRecord = Pick<
  Listing,
  "id" | "sellerId" | "title" | "priceCents" | "currency" | "status"
> & {
  variants: {
    id: string;
    label: string;
    priceCents: number;
    currency: string;
    inventoryCount: number;
  }[];
};

type UserRecord = { id: string; deletedAt: Date | null; role: string };

type OrderRecord = Pick<
  Order,
  | "id"
  | "orderNumber"
  | "buyerId"
  | "sellerId"
  | "status"
  | "paymentStatus"
  | "totalItemCents"
  | "shippingCents"
  | "feeCents"
  | "currency"
  | "shippingAddressId"
  | "billingAddressId"
  | "metadata"
  | "placedAt"
  | "paidAt"
  | "fulfilledAt"
  | "deliveredAt"
  | "cancelledAt"
  | "createdAt"
  | "updatedAt"
>;

type OrderItemRecord = {
  id: string;
  orderId: string;
  listingId: string;
  listingTitle: string;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
  unitPriceCents: number;
  currency: string;
};

type OrderTimelineRecord = {
  id: string;
  orderId: string;
  status: OrderStatus;
  note: string | null;
  actorId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

type PaymentTransactionRecord = {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  providerStatus: string | null;
  amountCents: number;
  currency: string;
  providerRef: string | null;
  metadata: Prisma.JsonValue | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type EscrowHoldingRecord = {
  id: string;
  orderId: string;
  status: EscrowStatus;
  amountCents: number;
  currency: string;
  releaseAfter: Date | null;
  releasedAt: Date | null;
  metadata: Prisma.JsonValue | null;
};

type EscrowTransactionRecord = {
  id: string;
  escrowId: string;
  type: EscrowTransactionType;
  amountCents: number;
  currency: string;
  note: string | null;
  actorId: string | null;
  createdAt: Date;
};

type AuditLogRecord = {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: Prisma.JsonValue | null;
};
