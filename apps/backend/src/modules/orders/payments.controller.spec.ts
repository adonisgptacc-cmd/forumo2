import { createHmac, randomUUID } from "node:crypto";
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
  PayoutStatus,
  Prisma,
} from "@prisma/client";
import request from "supertest";

import { PrismaService } from "../../prisma/prisma.service";
import { OrdersModule } from "./orders.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PaystackService } from "./paystack.service";
import { NotificationsService } from "../notifications/notifications.service";

// ─── Test credentials ─────────────────────────────────────────────────────────
// Fake keys: never real credentials. Used only for local HMAC computation.
const STRIPE_TEST_API_KEY = "sk_test_forumo_webhook_tests_fake_key_000000";
const STRIPE_TEST_WEBHOOK_SECRET = "whsec_forumo_test_secret_abc123def456";
const PAYSTACK_TEST_SECRET = "sk_test_forumo_paystack_secret_xyz789";

// ─── HMAC helpers ──────────────────────────────────────────────────────────────

/**
 * Produce a Stripe-format webhook signature header for the given raw body.
 * Stripe format: `t={unix_seconds},v1={HMAC-SHA256(secret, "{t}.{rawBody}")}`
 */
function stripeSignatureHeader(rawBody: string): string {
  const t = Math.floor(Date.now() / 1000);
  const hmac = createHmac("sha256", STRIPE_TEST_WEBHOOK_SECRET)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  return `t=${t},v1=${hmac}`;
}

/**
 * Produce the `x-paystack-signature` header value for the given raw body.
 * Paystack format: HMAC-SHA512(secret, rawBody) in hex.
 */
function paystackSignatureHeader(rawBody: string): string {
  return createHmac("sha512", PAYSTACK_TEST_SECRET)
    .update(rawBody)
    .digest("hex");
}

// ─── Seed identifiers ─────────────────────────────────────────────────────────
const BUYER_ID = "buyer-wh-1";
const SELLER_ID = "seller-wh-1";
const LISTING_ID = "listing-wh-1";

// Stripe webhook test orders (both start PENDING)
const STRIPE_ORDER_1 = "order-stripe-charge-succeeded";
const STRIPE_ORDER_2 = "order-stripe-payment-failed";
const STRIPE_REFUND_ORDER = "order-stripe-refund-pending";
const STRIPE_REFUND_PAYMENT_INTENT = "pi_test_refund_pending";

// Paystack webhook test order (PENDING + PAYSTACK payment transaction)
const PAYSTACK_ORDER_ID = "order-paystack-charge-success";
const PAYSTACK_TXN_REF = "TXN-PS-ref-abc123";
const PAYSTACK_TXN_AMOUNT_CENTS = 5000; // kobo; must match verifyTransaction mock
const FOREIGN_BUYER_ID = "buyer-wh-foreign";
const FOREIGN_PAYSTACK_ORDER_ID = "order-paystack-foreign";
const FOREIGN_PAYSTACK_TXN_REF = "TXN-PS-foreign-ref";

// Payout transfer codes for transfer.success / transfer.failed tests
const PAYOUT_SUCCESS_ID = "payout-success-wh-1";
const PAYOUT_FAILED_ID = "payout-failed-wh-1";
const TRANSFER_CODE_SUCCESS = "TRF_SUCCESS_abc123";
const TRANSFER_CODE_FAILED = "TRF_FAILED_xyz789";

// ─── MockAuthGuard ─────────────────────────────────────────────────────────────

class MockAuthGuard implements CanActivate {
  static currentUserId = BUYER_ID;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: MockAuthGuard.currentUserId, role: "BUYER" };
    return true;
  }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("PaymentsController — webhook integration", () => {
  let app: INestApplication;
  let db: WebhookInMemoryPrismaService;
  let verifyPaystackTransaction: jest.SpyInstance;

  beforeEach(async () => {
    MockAuthGuard.currentUserId = BUYER_ID;
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
    // Stripe: both keys must be set so PaymentsService creates a Stripe instance
    // and validateStripeEvent exercises the real HMAC path.
    process.env.STRIPE_SECRET_KEY = STRIPE_TEST_API_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = STRIPE_TEST_WEBHOOK_SECRET;
    // Paystack: must be set so validateWebhookSignature runs real HMAC.
    process.env.PAYSTACK_SECRET_KEY = PAYSTACK_TEST_SECRET;

    db = new WebhookInMemoryPrismaService();

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), OrdersModule],
    })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideGuard(JwtAuthGuard)
      .useClass(MockAuthGuard)
      // Suppress email/push side effects — payout handlers await sendEmail().
      .overrideProvider(NotificationsService)
      .useValue({
        sendEmail: jest.fn().mockResolvedValue(undefined),
        createInApp: jest.fn().mockResolvedValue(undefined),
        sendSms: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    // Spy on the HTTP-based verifyTransaction to avoid real Paystack API calls
    // while keeping validateWebhookSignature (pure HMAC) untouched.
    const paystackService = moduleRef.get(PaystackService);
    verifyPaystackTransaction = jest
      .spyOn(paystackService, "verifyTransaction")
      .mockResolvedValue({
        success: true,
        amountKobo: PAYSTACK_TXN_AMOUNT_CENTS,
        currency: "NGN",
        metadata: {},
      });

    // rawBody:true is required so req.rawBody is populated and the controllers
    // can compute HMAC over the exact bytes we send.
    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterEach(async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.PAYSTACK_SECRET_KEY;
    if (app) {
      await app.close().catch(() => {});
    }
    jest.restoreAllMocks();
  });

  // ─── Stripe ──────────────────────────────────────────────────────────────────

  describe("Stripe webhooks (POST /orders/payments/stripe/webhook)", () => {
    it("charge.succeeded transitions the order to PAID", async () => {
      const payload = {
        type: "charge.succeeded",
        data: {
          object: {
            id: "ch_test_stripe_1",
            status: "succeeded",
            metadata: { orderId: STRIPE_ORDER_1 },
          },
        },
      };
      const rawBody = JSON.stringify(payload);
      const sig = stripeSignatureHeader(rawBody);

      const res = await request(app.getHttpServer())
        .post("/orders/payments/stripe/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", sig)
        .send(rawBody)
        .expect(200);

      expect(res.body.received).toBe(true);
      expect(db.getOrderStatus(STRIPE_ORDER_1)).toBe(OrderStatus.PAID);
    });

    // A failed payment attempt is NOT a refund. The order must stay PENDING so
    // the buyer can retry; only the payment transaction is marked FAILED.
    it("payment_intent.payment_failed marks the payment FAILED and keeps the order retryable", async () => {
      const payload = {
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_test_failed",
            status: "requires_payment_method",
            metadata: { orderId: STRIPE_ORDER_2 },
          },
        },
      };
      const rawBody = JSON.stringify(payload);
      const sig = stripeSignatureHeader(rawBody);

      await request(app.getHttpServer())
        .post("/orders/payments/stripe/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", sig)
        .send(rawBody)
        .expect(200);

      expect(db.getOrderStatus(STRIPE_ORDER_2)).toBe(OrderStatus.PENDING);
      expect(db.getPaymentStatus(STRIPE_ORDER_2)).toBe(PaymentStatus.FAILED);
    });

    it("resolves a metadata-free Stripe refund by payment intent and confirms it", async () => {
      const payload = {
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_test_refunded",
            status: "succeeded",
            payment_intent: STRIPE_REFUND_PAYMENT_INTENT,
            metadata: {},
          },
        },
      };
      const rawBody = JSON.stringify(payload);

      await request(app.getHttpServer())
        .post("/orders/payments/stripe/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", stripeSignatureHeader(rawBody))
        .send(rawBody)
        .expect(200);

      expect(db.getOrderStatus(STRIPE_REFUND_ORDER)).toBe(OrderStatus.REFUNDED);
      expect(db.getPaymentStatus(STRIPE_REFUND_ORDER)).toBe(
        PaymentStatus.REFUNDED,
      );
    });

    it("keeps a pending refund nonterminal on refund.updated", async () => {
      const payload = {
        type: "refund.updated",
        data: {
          object: {
            id: "re_test_pending",
            status: "pending",
            payment_intent: STRIPE_REFUND_PAYMENT_INTENT,
            metadata: {},
          },
        },
      };
      const rawBody = JSON.stringify(payload);

      await request(app.getHttpServer())
        .post("/orders/payments/stripe/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", stripeSignatureHeader(rawBody))
        .send(rawBody)
        .expect(200);

      expect(db.getOrderStatus(STRIPE_REFUND_ORDER)).toBe(
        OrderStatus.REFUND_PENDING,
      );
      expect(db.getPaymentStatus(STRIPE_REFUND_ORDER)).toBe(
        PaymentStatus.REFUND_PENDING,
      );
    });

    it("keeps a failed refund retryable on refund.updated", async () => {
      const payload = {
        type: "refund.updated",
        data: {
          object: {
            id: "re_test_failed",
            status: "failed",
            payment_intent: STRIPE_REFUND_PAYMENT_INTENT,
            metadata: {},
          },
        },
      };
      const rawBody = JSON.stringify(payload);

      await request(app.getHttpServer())
        .post("/orders/payments/stripe/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", stripeSignatureHeader(rawBody))
        .send(rawBody)
        .expect(200);

      expect(db.getOrderStatus(STRIPE_REFUND_ORDER)).toBe(
        OrderStatus.REFUND_FAILED,
      );
      expect(db.getPaymentStatus(STRIPE_REFUND_ORDER)).toBe(
        PaymentStatus.REFUND_FAILED,
      );
    });

    it("rejects an invalid Stripe HMAC with 400 and leaves the order unchanged", async () => {
      const statusBefore = db.getOrderStatus(STRIPE_ORDER_1);

      const payload = {
        type: "charge.succeeded",
        data: { object: { metadata: { orderId: STRIPE_ORDER_1 } } },
      };
      const rawBody = JSON.stringify(payload);
      // Properly formatted header but the HMAC value is wrong.
      const badSig =
        "t=1234567890,v1=0000000000000000000000000000000000000000000000000000000000000000";

      await request(app.getHttpServer())
        .post("/orders/payments/stripe/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", badSig)
        .send(rawBody)
        .expect(400);

      // Order must remain in its pre-webhook state.
      expect(db.getOrderStatus(STRIPE_ORDER_1)).toBe(statusBefore);
    });
  });

  describe("Order status refund authorization", () => {
    it("forbids buyers from initiating provider refund states", async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${STRIPE_REFUND_ORDER}/status`)
        .send({ status: OrderStatus.REFUNDED })
        .expect(403);
    });

    it("forbids non-admin cancellation after payment capture begins", async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${STRIPE_REFUND_ORDER}/status`)
        .send({ status: OrderStatus.CANCELLED })
        .expect(403);
    });
  });

  // ─── Paystack ─────────────────────────────────────────────────────────────────

  describe("Paystack webhooks (POST /orders/payments/paystack/webhook)", () => {
    it("charge.success transitions the order to PAID", async () => {
      const payload = {
        event: "charge.success",
        data: { reference: PAYSTACK_TXN_REF },
      };
      const rawBody = JSON.stringify(payload);
      const sig = paystackSignatureHeader(rawBody);

      await request(app.getHttpServer())
        .post("/orders/payments/paystack/webhook")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", sig)
        .send(rawBody)
        .expect(200);

      expect(db.getOrderStatus(PAYSTACK_ORDER_ID)).toBe(OrderStatus.PAID);
    });

    it("transfer.success transitions the payout to PAID", async () => {
      const payload = {
        event: "transfer.success",
        data: { transfer_code: TRANSFER_CODE_SUCCESS, status: "success" },
      };
      const rawBody = JSON.stringify(payload);
      const sig = paystackSignatureHeader(rawBody);

      await request(app.getHttpServer())
        .post("/orders/payments/paystack/webhook")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", sig)
        .send(rawBody)
        .expect(200);

      expect(db.getPayoutStatus(PAYOUT_SUCCESS_ID)).toBe(PayoutStatus.PAID);
    });

    it("transfer.failed transitions the payout to FAILED when retry budget is exhausted", async () => {
      // The payout is seeded with retryCount=1 so shouldRetry (retryCount < 1) is false
      // and the handler immediately marks it FAILED without re-queuing.
      const payload = {
        event: "transfer.failed",
        data: {
          transfer_code: TRANSFER_CODE_FAILED,
          reason: "Insufficient balance",
          status: "failed",
        },
      };
      const rawBody = JSON.stringify(payload);
      const sig = paystackSignatureHeader(rawBody);

      await request(app.getHttpServer())
        .post("/orders/payments/paystack/webhook")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", sig)
        .send(rawBody)
        .expect(200);

      expect(db.getPayoutStatus(PAYOUT_FAILED_ID)).toBe(PayoutStatus.FAILED);
    });

    it("rejects an invalid x-paystack-signature with 401 and leaves the order unchanged", async () => {
      const statusBefore = db.getOrderStatus(PAYSTACK_ORDER_ID);
      const payoutStatusBefore = db.getPayoutStatus(PAYOUT_SUCCESS_ID);

      const payload = {
        event: "charge.success",
        data: { reference: PAYSTACK_TXN_REF },
      };

      await request(app.getHttpServer())
        .post("/orders/payments/paystack/webhook")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", "invalidsignaturethatisnotvalidhmac")
        .send(JSON.stringify(payload))
        .expect(401);

      expect(db.getOrderStatus(PAYSTACK_ORDER_ID)).toBe(statusBefore);
      expect(db.getPayoutStatus(PAYOUT_SUCCESS_ID)).toBe(payoutStatusBefore);
    });
  });

  describe("Paystack verification (POST /orders/payments/paystack/verify)", () => {
    it("authorizes order ownership before contacting Paystack or mutating payment state", async () => {
      await request(app.getHttpServer())
        .post("/orders/payments/paystack/verify")
        .send({ reference: FOREIGN_PAYSTACK_TXN_REF })
        .expect(404);

      expect(verifyPaystackTransaction).not.toHaveBeenCalled();
      expect(db.getOrderStatus(FOREIGN_PAYSTACK_ORDER_ID)).toBe(
        OrderStatus.PENDING,
      );
      expect(db.getPaymentStatus(FOREIGN_PAYSTACK_ORDER_ID)).toBe(
        PaymentStatus.PENDING,
      );
    });
  });
});

// ─── In-memory Prisma service ─────────────────────────────────────────────────

class WebhookInMemoryPrismaService {
  private readonly usersMap = new Map<string, UserRecord>();
  private readonly listingsMap = new Map<string, ListingRecord>();
  private readonly ordersMap = new Map<string, OrderRecord>();
  private readonly itemsMap = new Map<string, OrderItemRecord>();
  private readonly timelinesMap = new Map<string, OrderTimelineRecord[]>();
  private readonly paymentsMap = new Map<string, PaymentTransactionRecord[]>();
  private readonly escrowsMap = new Map<string, EscrowHoldingRecord>();
  private readonly escrowTxnsMap = new Map<string, EscrowTransactionRecord[]>();
  private readonly payoutsMap = new Map<string, PayoutRecord>();

  constructor() {
    this.seed();
  }

  // ─── Public test helpers ────────────────────────────────────────────────────

  getOrderStatus(orderId: string): OrderStatus | undefined {
    return this.ordersMap.get(orderId)?.status;
  }

  getPaymentStatus(orderId: string): PaymentStatus | undefined {
    return this.paymentsMap.get(orderId)?.[0]?.status;
  }

  getPayoutStatus(payoutId: string): PayoutStatus | undefined {
    return this.payoutsMap.get(payoutId)?.status;
  }

  // ─── Seeding ────────────────────────────────────────────────────────────────

  private seed() {
    const now = new Date();

    this.usersMap.set(BUYER_ID, {
      id: BUYER_ID,
      email: "buyer@test.com",
      name: "Test Buyer",
      deletedAt: null,
    });
    this.usersMap.set(FOREIGN_BUYER_ID, {
      id: FOREIGN_BUYER_ID,
      email: "foreign@test.com",
      name: "Foreign Buyer",
      deletedAt: null,
    });
    this.usersMap.set(SELLER_ID, {
      id: SELLER_ID,
      email: "seller@test.com",
      name: "Test Seller",
      deletedAt: null,
    });

    this.listingsMap.set(LISTING_ID, {
      id: LISTING_ID,
      sellerId: SELLER_ID,
      title: "Test Listing",
      priceCents: 5000,
      currency: "USD",
      status: ListingStatus.PUBLISHED,
      variants: [],
    });

    // Two PENDING orders for Stripe tests
    this.seedOrder(STRIPE_ORDER_1, "ORD-STRIPE-1", OrderStatus.PENDING, now);
    this.seedOrder(STRIPE_ORDER_2, "ORD-STRIPE-2", OrderStatus.PENDING, now);
    this.seedOrder(
      STRIPE_REFUND_ORDER,
      "ORD-STRIPE-REFUND",
      OrderStatus.REFUND_PENDING,
      now,
    );

    this.paymentsMap.set(STRIPE_ORDER_1, [
      this.paymentRecord(
        STRIPE_ORDER_1,
        PaymentStatus.PENDING,
        "requires_payment_method",
        now,
      ),
    ]);
    this.paymentsMap.set(STRIPE_ORDER_2, [
      this.paymentRecord(
        STRIPE_ORDER_2,
        PaymentStatus.PENDING,
        "requires_payment_method",
        now,
      ),
    ]);
    this.paymentsMap.set(STRIPE_REFUND_ORDER, [
      {
        ...this.paymentRecord(
          STRIPE_REFUND_ORDER,
          PaymentStatus.REFUND_PENDING,
          "pending",
          now,
        ),
        providerRef: STRIPE_REFUND_PAYMENT_INTENT,
      },
    ]);

    // PENDING order for Paystack charge.success test, with a PAYSTACK payment
    // transaction whose providerRef matches PAYSTACK_TXN_REF.
    this.seedOrder(PAYSTACK_ORDER_ID, "ORD-PS-1", OrderStatus.PENDING, now);
    const psTxn: PaymentTransactionRecord = {
      id: randomUUID(),
      orderId: PAYSTACK_ORDER_ID,
      provider: PaymentProvider.PAYSTACK,
      status: PaymentStatus.PENDING,
      providerStatus: "pending",
      amountCents: PAYSTACK_TXN_AMOUNT_CENTS,
      currency: "NGN",
      providerRef: PAYSTACK_TXN_REF,
      metadata: null,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.paymentsMap.set(PAYSTACK_ORDER_ID, [psTxn]);

    this.seedOrder(
      FOREIGN_PAYSTACK_ORDER_ID,
      "ORD-PS-FOREIGN",
      OrderStatus.PENDING,
      now,
    );
    const foreignOrder = this.ordersMap.get(FOREIGN_PAYSTACK_ORDER_ID)!;
    foreignOrder.buyerId = FOREIGN_BUYER_ID;
    this.paymentsMap.set(FOREIGN_PAYSTACK_ORDER_ID, [
      {
        ...this.paymentRecord(
          FOREIGN_PAYSTACK_ORDER_ID,
          PaymentStatus.PENDING,
          "initialized",
          now,
        ),
        provider: PaymentProvider.PAYSTACK,
        providerRef: FOREIGN_PAYSTACK_TXN_REF,
        amountCents: PAYSTACK_TXN_AMOUNT_CENTS,
        currency: "NGN",
      },
    ]);

    // Payout for transfer.success — retryCount 0, PROCESSING
    this.payoutsMap.set(PAYOUT_SUCCESS_ID, {
      id: PAYOUT_SUCCESS_ID,
      sellerId: SELLER_ID,
      amount: 5000,
      currency: "ngn",
      status: PayoutStatus.PROCESSING,
      paystackTransferCode: TRANSFER_CODE_SUCCESS,
      stripeTransferId: null,
      retryCount: 0,
      failureReason: null,
      processedAt: null,
      scheduledAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Payout for transfer.failed — retryCount 1 so shouldRetry=false → FAILED
    this.payoutsMap.set(PAYOUT_FAILED_ID, {
      id: PAYOUT_FAILED_ID,
      sellerId: SELLER_ID,
      amount: 5000,
      currency: "ngn",
      status: PayoutStatus.PROCESSING,
      paystackTransferCode: TRANSFER_CODE_FAILED,
      stripeTransferId: null,
      retryCount: 1,
      failureReason: null,
      processedAt: null,
      scheduledAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  private seedOrder(
    id: string,
    orderNumber: string,
    status: OrderStatus,
    now: Date,
  ) {
    const rec: OrderRecord = {
      id,
      orderNumber,
      buyerId: BUYER_ID,
      sellerId: SELLER_ID,
      status,
      paymentStatus: PaymentStatus.PENDING,
      totalItemCents: 5000,
      shippingCents: 0,
      feeCents: 0,
      currency: "USD",
      shippingAddressId: null,
      billingAddressId: null,
      metadata: null,
      placedAt: now,
      paidAt: null,
      fulfilledAt: null,
      deliveredAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.ordersMap.set(id, rec);
    this.timelinesMap.set(id, [this.makeTimelineEvent(id, status, "Seeded")]);
    this.paymentsMap.set(id, []);
  }

  private paymentRecord(
    orderId: string,
    status: PaymentStatus,
    providerStatus: string,
    now: Date,
  ): PaymentTransactionRecord {
    return {
      id: randomUUID(),
      orderId,
      provider: PaymentProvider.STRIPE,
      status,
      providerStatus,
      amountCents: 5000,
      currency: "USD",
      providerRef: null,
      metadata: null,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private makeTimelineEvent(
    orderId: string,
    status: OrderStatus,
    note: string,
  ): OrderTimelineRecord {
    return {
      id: randomUUID(),
      orderId,
      status,
      note,
      actorId: null,
      metadata: null,
      createdAt: new Date(),
    };
  }

  // ─── Prisma $transaction ────────────────────────────────────────────────────

  async $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T> {
    return fn(this);
  }

  // ─── user ───────────────────────────────────────────────────────────────────

  user = {
    findFirst: async ({
      where,
    }: {
      where: { id: string; deletedAt: null };
    }) => {
      const rec = this.usersMap.get(where.id);
      return rec && rec.deletedAt === null ? rec : null;
    },
    findUnique: async ({ where }: { where: { id?: string } }) => {
      if (!where.id) return null;
      return this.usersMap.get(where.id) ?? null;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const rec = this.usersMap.get(where.id);
      if (rec) Object.assign(rec, data);
      return rec ?? null;
    },
    updateMany: async ({
      where: _where,
      data: _data,
    }: {
      where: unknown;
      data: unknown;
    }) => {
      // Used by handleAccountUpdated — no assertions on the result in these tests.
      return { count: 0 };
    },
  };

  // ─── listing ────────────────────────────────────────────────────────────────

  listing = {
    findMany: async ({
      where,
    }: {
      where: { id: { in: string[] }; deletedAt: null };
    }) =>
      where.id.in
        .map((id) => this.listingsMap.get(id))
        .filter((v): v is ListingRecord => v != null),
  };

  // ─── order ──────────────────────────────────────────────────────────────────

  order = {
    findMany: async ({ include }: { include?: Prisma.OrderInclude }) =>
      Array.from(this.ordersMap.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((o) => this.buildOrder(o, include)),

    findFirst: async ({
      where,
      include,
    }: {
      where: { id?: string };
      include?: Prisma.OrderInclude;
    }) => {
      const rec = where.id ? this.ordersMap.get(where.id) : undefined;
      return rec ? this.buildOrder(rec, include) : null;
    },

    findUnique: async ({
      where,
      include,
    }: {
      where: { id: string };
      include?: Prisma.OrderInclude;
    }) => {
      const rec = this.ordersMap.get(where.id);
      return rec ? this.buildOrder(rec, include) : null;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    create: async ({ data }: { data: any }) => {
      const id = randomUUID();
      const now = new Date();
      const rec: OrderRecord = {
        id,
        orderNumber: data.orderNumber,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        status: data.status ?? OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        totalItemCents: data.totalItemCents,
        shippingCents: data.shippingCents ?? 0,
        feeCents: data.feeCents ?? 0,
        currency: data.currency ?? "USD",
        shippingAddressId: data.shippingAddressId ?? null,
        billingAddressId: data.billingAddressId ?? null,
        metadata: data.metadata ?? null,
        placedAt: data.placedAt ?? now,
        paidAt: null,
        fulfilledAt: null,
        deliveredAt: null,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.ordersMap.set(id, rec);
      if (data.items?.create) {
        const items = Array.isArray(data.items.create)
          ? data.items.create
          : [data.items.create];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        items.forEach((item: any) => this.addItem(id, item));
      }
      if (data.timeline?.create) {
        const events = Array.isArray(data.timeline.create)
          ? data.timeline.create
          : [data.timeline.create];
        this.timelinesMap.set(
          id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
          events.map((e: any) =>
            this.makeTimelineEvent(id, e.status, e.note ?? ""),
          ),
        );
      }
      return rec;
    },

    update: async ({
      where,
      data,
      include,
    }: {
      where: { id: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      data: any;
      include?: Prisma.OrderInclude;
    }) => {
      const rec = this.ordersMap.get(where.id);
      if (!rec) throw new Error(`Order ${where.id} not found`);
      Object.assign(rec, {
        status: data.status ?? rec.status,
        paymentStatus: data.paymentStatus ?? rec.paymentStatus,
        paidAt: data.paidAt ?? rec.paidAt,
        fulfilledAt: data.fulfilledAt ?? rec.fulfilledAt,
        deliveredAt: data.deliveredAt ?? rec.deliveredAt,
        cancelledAt: data.cancelledAt ?? rec.cancelledAt,
        updatedAt: new Date(),
      });
      if (data.timeline?.create) {
        const existing = this.timelinesMap.get(rec.id) ?? [];
        const events = Array.isArray(data.timeline.create)
          ? data.timeline.create
          : [data.timeline.create];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        events.forEach((e: any) =>
          existing.push(this.makeTimelineEvent(rec.id, e.status, e.note ?? "")),
        );
        this.timelinesMap.set(rec.id, existing);
      }
      return this.buildOrder(rec, include);
    },
  };

  // ─── paymentTransaction ─────────────────────────────────────────────────────

  paymentTransaction = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    create: async ({ data }: { data: any }) => {
      const rec: PaymentTransactionRecord = {
        id: randomUUID(),
        orderId: data.orderId,
        provider: data.provider ?? PaymentProvider.STRIPE,
        status: data.status ?? PaymentStatus.PENDING,
        providerStatus: data.providerStatus ?? null,
        amountCents: data.amountCents,
        currency: data.currency ?? "USD",
        providerRef: data.providerRef ?? null,
        metadata: data.metadata ?? null,
        processedAt: data.processedAt ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const list = this.paymentsMap.get(data.orderId) ?? [];
      list.push(rec);
      this.paymentsMap.set(data.orderId, list);
      return rec;
    },

    updateMany: async ({
      where,
      data,
    }: {
      where: { orderId: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      data: any;
    }) => {
      const records = this.paymentsMap.get(where.orderId) ?? [];
      records.forEach((r) => {
        if (data.status !== undefined) r.status = data.status;
        if (data.providerStatus !== undefined)
          r.providerStatus = data.providerStatus;
        if (data.processedAt !== undefined) r.processedAt = data.processedAt;
        r.updatedAt = new Date();
      });
      this.paymentsMap.set(where.orderId, records);
      return { count: records.length };
    },

    // Handles all findFirst call signatures used across the order + payment services.
    findFirst: async ({
      where,
      include,
    }: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      where: any;
      include?: { order?: unknown };
    }) => {
      // Search across all orders so providerRef lookups (no orderId) work too.
      const all = Array.from(this.paymentsMap.values()).flat();
      const payment =
        all.find((p) => {
          if (where.orderId && p.orderId !== where.orderId) return false;
          if (where.provider && p.provider !== where.provider) return false;
          if (where.providerRef !== undefined) {
            if (typeof where.providerRef === "string") {
              if (p.providerRef !== where.providerRef) return false;
            } else if (
              where.providerRef !== null &&
              typeof where.providerRef === "object" &&
              "not" in where.providerRef
            ) {
              // Prisma `{ not: null }` — keep only records with a non-null providerRef.
              if (p.providerRef === where.providerRef.not) return false;
            }
          }
          if (where.status) {
            if (typeof where.status === "string") {
              if (p.status !== where.status) return false;
            } else if (Array.isArray(where.status?.in)) {
              if (!where.status.in.includes(p.status)) return false;
            }
          }
          return true;
        }) ?? null;
      if (!payment || !include?.order) return payment;

      const order = this.ordersMap.get(payment.orderId);
      return order
        ? {
            ...payment,
            order: { buyerId: order.buyerId, sellerId: order.sellerId },
          }
        : null;
    },
  };

  return = {
    updateMany: async () => ({ count: 0 }),
  };

  // ─── escrowHolding ──────────────────────────────────────────────────────────

  escrowHolding = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    create: async ({ data }: { data: any }) => {
      const rec: EscrowHoldingRecord = {
        id: randomUUID(),
        orderId: data.orderId,
        status: data.status ?? EscrowStatus.HOLDING,
        amountCents: data.amountCents,
        currency: data.currency ?? "USD",
        releaseAfter: null,
        releasedAt: null,
        metadata: null,
      };
      this.escrowsMap.set(data.orderId, rec);
      this.escrowTxnsMap.set(rec.id, []);
      return rec;
    },

    findUnique: async ({
      where,
    }: {
      where: { orderId?: string; id?: string };
    }) => {
      if (where.orderId) return this.escrowsMap.get(where.orderId) ?? null;
      return (
        Array.from(this.escrowsMap.values()).find((e) => e.id === where.id) ??
        null
      );
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const rec = Array.from(this.escrowsMap.values()).find(
        (e) => e.id === where.id,
      );
      if (!rec) throw new Error(`EscrowHolding ${where.id} not found`);
      if (data.status !== undefined) rec.status = data.status;
      if (data.releasedAt !== undefined) rec.releasedAt = data.releasedAt;
      return rec;
    },
  };

  // ─── escrowTransaction ──────────────────────────────────────────────────────

  escrowTransaction = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    create: async ({ data }: { data: any }) => {
      const rec: EscrowTransactionRecord = {
        id: randomUUID(),
        escrowId: data.escrowId,
        type: data.type as EscrowTransactionType,
        amountCents: data.amountCents,
        currency: data.currency ?? "USD",
        note: data.note ?? null,
        actorId: data.actorId ?? null,
        createdAt: new Date(),
      };
      const list = this.escrowTxnsMap.get(data.escrowId) ?? [];
      list.push(rec);
      this.escrowTxnsMap.set(data.escrowId, list);
      return rec;
    },
  };

  // ─── auditLog ───────────────────────────────────────────────────────────────

  auditLog = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    create: async ({ data }: { data: any }) => ({
      id: randomUUID(),
      actorId: data.actorId ?? null,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      payload: data.payload ?? null,
    }),
  };

  // ─── webhookEvent ───────────────────────────────────────────────────────────

  webhookEvent = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    create: async ({ data }: { data: any }) => ({ id: randomUUID(), ...data }),
    update: async () => ({}),
  };

  // ─── payout ─────────────────────────────────────────────────────────────────

  payout = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    findUnique: async ({ where, include }: { where: any; include?: any }) => {
      let rec: PayoutRecord | undefined;

      if (where.id) {
        rec = this.payoutsMap.get(where.id);
      } else if (where.paystackTransferCode) {
        rec = Array.from(this.payoutsMap.values()).find(
          (p) => p.paystackTransferCode === where.paystackTransferCode,
        );
      } else if (where.stripeTransferId) {
        rec = Array.from(this.payoutsMap.values()).find(
          (p) => p.stripeTransferId === where.stripeTransferId,
        );
      }

      if (!rec) return null;

      if (include?.seller) {
        const seller = this.usersMap.get(rec.sellerId);
        return {
          ...rec,
          seller: { email: seller?.email ?? "", name: seller?.name ?? "" },
        };
      }

      return rec;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const rec = this.payoutsMap.get(where.id);
      if (!rec) throw new Error(`Payout ${where.id} not found`);

      if (data.status !== undefined) rec.status = data.status;
      if (data.processedAt !== undefined) rec.processedAt = data.processedAt;
      if (data.failureReason !== undefined)
        rec.failureReason = data.failureReason;
      if (data.scheduledAt !== undefined) rec.scheduledAt = data.scheduledAt;
      if ("paystackTransferCode" in data)
        rec.paystackTransferCode = data.paystackTransferCode;
      if ("stripeTransferId" in data)
        rec.stripeTransferId = data.stripeTransferId;

      if (data.retryCount !== undefined) {
        if (
          typeof data.retryCount === "object" &&
          "increment" in data.retryCount
        ) {
          rec.retryCount += data.retryCount.increment;
        } else {
          rec.retryCount = data.retryCount;
        }
      }

      rec.updatedAt = new Date();
      return rec;
    },
  };

  // ─── Private build helpers ──────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  private addItem(orderId: string, item: any) {
    const id = randomUUID();
    this.itemsMap.set(id, {
      id,
      orderId,
      listingId: item.listingId,
      listingTitle: item.listingTitle ?? "Unknown",
      variantId: item.variantId ?? null,
      variantLabel: item.variantLabel ?? null,
      quantity: item.quantity ?? 1,
      unitPriceCents: item.unitPriceCents ?? 0,
      currency: item.currency ?? "USD",
    });
  }

  private buildOrder(rec: OrderRecord, include?: Prisma.OrderInclude | null) {
    return {
      ...rec,
      items: include?.items ? this.getItems(rec.id) : undefined,
      shipments: [],
      timeline: include?.timeline ? this.getTimeline(rec.id) : undefined,
      payments: include?.payments ? this.getPayments(rec.id) : undefined,
      escrow: include?.escrow ? this.getEscrow(rec.id) : null,
    };
  }

  private getItems(orderId: string) {
    return Array.from(this.itemsMap.values()).filter(
      (i) => i.orderId === orderId,
    );
  }

  private getTimeline(orderId: string) {
    return [...(this.timelinesMap.get(orderId) ?? [])];
  }

  private getPayments(orderId: string) {
    return [...(this.paymentsMap.get(orderId) ?? [])];
  }

  private getEscrow(orderId: string) {
    const escrow = this.escrowsMap.get(orderId) ?? null;
    if (!escrow) return null;
    return {
      ...escrow,
      disputes: [],
      transactions: [...(this.escrowTxnsMap.get(escrow.id) ?? [])],
    };
  }
}

// ─── Record types ─────────────────────────────────────────────────────────────

type UserRecord = {
  id: string;
  email: string;
  name: string;
  deletedAt: Date | null;
};

type ListingRecord = Pick<
  Listing,
  "id" | "sellerId" | "title" | "priceCents" | "currency" | "status"
> & {
  variants: {
    id: string;
    label: string;
    priceCents: number;
    currency: string;
  }[];
};

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

type PayoutRecord = {
  id: string;
  sellerId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  paystackTransferCode: string | null;
  stripeTransferId: string | null;
  retryCount: number;
  failureReason: string | null;
  processedAt: Date | null;
  scheduledAt: Date;
  createdAt: Date;
  updatedAt: Date;
};
