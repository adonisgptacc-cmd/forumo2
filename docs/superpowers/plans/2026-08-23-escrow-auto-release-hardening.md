# Escrow Auto-Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix escrow auto-release so it only ever fires after delivery is confirmed (currently it fires 14 days after order creation regardless of delivery status, due to a dead code path), consolidate the two competing escrow-release implementations into one, and close the retry/observability gaps in the existing payout pipeline.

**Architecture:** No new subsystems. This hardens an existing, working pipeline (hourly escrow-release cron → daily payout-scheduling/processing/reconciliation crons → provider webhook handlers) by fixing a dead conditional, removing a duplicate implementation, and adding two small endpoints plus metrics using infrastructure that already exists (an unused Prometheus counter, the existing audit-log service).

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL, `@nestjs/schedule` cron, Jest.

**Spec:** `docs/superpowers/specs/2026-08-23-escrow-auto-release-hardening-design.md`

## Global Constraints

- This is a protected payments/escrow change (`.assistant/rules/protected-paths.md`) — already approved per the linked spec's "Approval" section; do not expand scope beyond what's in the spec without going back to the Project Owner.
- Escrow release must remain idempotent and concurrency-safe across backend replicas (roadmap RR-013 acceptance criterion) — every state transition this plan touches uses an atomic conditional `updateMany`, never a plain `update`, for the guarded status field.
- Reuse `EscrowService.releaseEscrow()` as the single release implementation — do not duplicate transfer or state-transition logic (roadmap RR-013, and this plan's own Task 6).
- No Prisma schema migration is needed anywhere in this plan (`EscrowHolding.releaseAfter` is already nullable).
- Backend conventions: `Logger` per class (`new Logger(ClassName.name)`), NestJS `HttpException` subclasses not raw `Error`, roles via `@Roles()` + `RolesGuard`, cross-service transaction passing via a `Prisma.TransactionClient` parameter (see `PaymentsService.markPaymentCaptured`).

---

### Task 1: Give `EscrowService.releaseEscrow()` a transaction-client parameter and an audit-log write

**Files:**

- Modify: `apps/backend/src/modules/escrow/escrow.service.ts`
- Test: `apps/backend/src/modules/escrow/escrow.service.spec.ts` (new file)

**Interfaces:**

- Produces: `EscrowService.releaseEscrow(orderId: string, actorId: string, note?: string, client: Prisma.TransactionClient = this.prisma): Promise<EscrowHolding>` — same return shape as today, but now accepts an optional transaction client so callers (Task 6) can run it inside their own transaction. Also now writes an `AuditLog` row for every release (previously only the `orders.service.ts` path did this).

- [ ] **Step 1: Write the failing unit test for the transaction-client parameter**

Create `apps/backend/src/modules/escrow/escrow.service.spec.ts`:

```ts
import { Prisma } from "@prisma/client";
import { EscrowService } from "./escrow.service";

function buildPrismaMock(overrides: Record<string, unknown> = {}) {
  const escrow = {
    id: "escrow-1",
    orderId: "order-1",
    status: "HOLDING",
    amountCents: 5000,
    currency: "USD",
    releaseAfter: null,
  };
  return {
    escrowHolding: {
      findUnique: jest.fn().mockResolvedValue(escrow),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
    escrowTransaction: {
      create: jest.fn().mockResolvedValue({ id: "txn-1" }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: "audit-1" }),
    },
    order: {
      findUnique: jest.fn().mockResolvedValue({
        seller: { email: "seller@test.com", name: "Seller" },
      }),
    },
    ...overrides,
  };
}

function buildService(prisma: ReturnType<typeof buildPrismaMock>) {
  const notifications = {
    notifyEscrowReleased: jest.fn().mockResolvedValue(undefined),
  };
  return new EscrowService(prisma as never, notifications as never);
}

describe("EscrowService.releaseEscrow", () => {
  it("uses the passed-in transaction client instead of this.prisma when provided", async () => {
    const txClient = buildPrismaMock();
    const service = buildService(buildPrismaMock());

    await service.releaseEscrow(
      "order-1",
      "actor-1",
      "test note",
      txClient as unknown as Prisma.TransactionClient,
    );

    expect(txClient.escrowHolding.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order-1", status: "HOLDING" },
      data: expect.objectContaining({ status: "RELEASED" }),
    });
  });

  it("writes an audit log entry identifying the actor", async () => {
    const prisma = buildPrismaMock();
    const service = buildService(prisma);

    await service.releaseEscrow("order-1", "actor-1", "test note");

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "actor-1",
        action: "escrow.release",
        entityType: "order",
        entityId: "order-1",
      }),
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter backend exec jest escrow/escrow.service.spec.ts -t "releaseEscrow"`
Expected: FAIL — `releaseEscrow` currently only takes 3 arguments and never calls `auditLog.create`.

- [ ] **Step 3: Modify `releaseEscrow()`**

In `apps/backend/src/modules/escrow/escrow.service.ts`, add `Prisma` to the existing `@prisma/client` import (currently `import { EscrowStatus } from "@prisma/client";` — change to `import { EscrowStatus, Prisma } from "@prisma/client";`).

Replace the `releaseEscrow` method (currently lines 122–181) with:

```ts
async releaseEscrow(
  orderId: string,
  actorId: string,
  note?: string,
  client: Prisma.TransactionClient = this.prisma,
) {
  const escrow = await client.escrowHolding.findUnique({
    where: { orderId },
  });

  if (!escrow) {
    throw new NotFoundException("Escrow not found");
  }

  // Atomic conditional update — prevents duplicate releases under concurrent requests
  const result = await client.escrowHolding.updateMany({
    where: { orderId, status: "HOLDING" },
    data: { status: "RELEASED", releasedAt: new Date() },
  });

  if (result.count === 0) {
    throw new BadRequestException(
      `Cannot release escrow with status: ${escrow.status}`,
    );
  }

  const updated = await client.escrowHolding.findUnique({
    where: { orderId },
  });
  if (!updated) throw new NotFoundException("Escrow not found after release");

  // Create transaction record
  await client.escrowTransaction.create({
    data: {
      escrowId: escrow.id,
      type: "RELEASE",
      amountCents: escrow.amountCents,
      currency: escrow.currency,
      actorId,
      note: note || "Funds released to seller",
    },
  });

  await client.auditLog.create({
    data: {
      actorId,
      action: "escrow.release",
      entityType: "order",
      entityId: orderId,
      payload: {
        amountCents: escrow.amountCents,
        currency: escrow.currency,
        note: note ?? null,
      },
    },
  });

  // Payout is scheduled and processed by PayoutsService's own cron chain
  // (schedulePayouts -> processPendingPayouts), not synchronously here.
  this.logger.log(
    `Escrow for order ${orderId} released; payout will be scheduled by PayoutsService.`,
  );

  const releaseOrder = await client.order.findUnique({
    where: { id: orderId },
    select: { seller: { select: { email: true, name: true } } },
  });
  if (releaseOrder?.seller) {
    await this.notifications.notifyEscrowReleased(
      releaseOrder.seller.email,
      releaseOrder.seller.name ?? "Seller",
      orderId,
      escrow.amountCents,
      escrow.currency,
    );
  }

  return updated;
}
```

This removes the stale `[PAYOUT PENDING] ... Integrate Stripe Connect transfer or equivalent before going live` log line (design spec section 8) as part of the same edit.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter backend exec jest escrow/escrow.service.spec.ts -t "releaseEscrow"`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the existing escrow e2e suite to confirm no regression**

Run: `pnpm --filter backend exec jest escrow/escrow.spec.ts`
Expected: PASS — the existing `InMemoryPrismaService` mock in `escrow.spec.ts` doesn't implement `auditLog.create`; if this fails, add a minimal `get auditLog() { return { create: async ({ data }: any) => ({ id: "audit-1", ...data }) }; }` accessor to that file's `InMemoryPrismaService` class, following the same pattern as its existing `escrowTransaction` accessor.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/escrow/escrow.service.ts apps/backend/src/modules/escrow/escrow.service.spec.ts apps/backend/src/modules/escrow/escrow.spec.ts
git commit -m "feat(escrow): accept a transaction client and write an audit log in releaseEscrow"
```

---

### Task 2: Fix the release-window bug — stop hardcoding `releaseAfter` at creation, add `startReleaseCountdown`

**Files:**

- Modify: `apps/backend/src/modules/escrow/escrow.service.ts`
- Test: `apps/backend/src/modules/escrow/escrow.service.spec.ts`

**Interfaces:**

- Consumes: nothing new from Task 1.
- Produces: `EscrowService.startReleaseCountdown(orderId: string): Promise<void>` — idempotent; no-ops if the escrow doesn't exist, isn't `HOLDING`, or already has `releaseAfter` set. Otherwise sets `releaseAfter` and transitions the order to `DELIVERED`. Tasks 3 and 5 call this method.

- [ ] **Step 1: Write the failing tests**

Add to `apps/backend/src/modules/escrow/escrow.service.spec.ts`:

```ts
describe("EscrowService.createEscrowHolding", () => {
  it("does not set releaseAfter at creation time", async () => {
    const prisma = buildPrismaMock({
      escrowHolding: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => data),
      },
    });
    const service = buildService(prisma);

    const result = await service.createEscrowHolding("order-2", 5000, "USD");

    expect(result.releaseAfter).toBeUndefined();
  });
});

describe("EscrowService.startReleaseCountdown", () => {
  it("sets releaseAfter and marks the order DELIVERED when escrow is HOLDING with no releaseAfter set", async () => {
    const order = { id: "order-1", status: "FULFILLED" };
    const prisma = buildPrismaMock({
      escrowHolding: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: "escrow-1",
            orderId: "order-1",
            status: "HOLDING",
            releaseAfter: null,
          }),
        update: jest.fn().mockResolvedValue({}),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockResolvedValue({}),
      },
      orderTimelineEvent: { create: jest.fn().mockResolvedValue({}) },
    });
    const service = buildService(prisma);

    await service.startReleaseCountdown("order-1");

    expect(prisma.escrowHolding.update).toHaveBeenCalledWith({
      where: { id: "escrow-1" },
      data: { releaseAfter: expect.any(Date) },
    });
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: expect.objectContaining({ status: "DELIVERED" }),
      }),
    );
  });

  it("is a no-op when releaseAfter is already set", async () => {
    const prisma = buildPrismaMock({
      escrowHolding: {
        findUnique: jest.fn().mockResolvedValue({
          id: "escrow-1",
          orderId: "order-1",
          status: "HOLDING",
          releaseAfter: new Date(),
        }),
        update: jest.fn(),
      },
      order: { findUnique: jest.fn(), update: jest.fn() },
    });
    const service = buildService(prisma);

    await service.startReleaseCountdown("order-1");

    expect(prisma.escrowHolding.update).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("is a no-op when there is no HOLDING escrow for the order", async () => {
    const prisma = buildPrismaMock({
      escrowHolding: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    });
    const service = buildService(prisma);

    await service.startReleaseCountdown("order-nonexistent");

    expect(prisma.escrowHolding.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter backend exec jest escrow/escrow.service.spec.ts -t "startReleaseCountdown"`
Expected: FAIL — `startReleaseCountdown` doesn't exist yet; `createEscrowHolding` test fails because `releaseAfter` is currently always set.

- [ ] **Step 3: Add `ConfigService` injection and implement the fix**

In `apps/backend/src/modules/escrow/escrow.service.ts`, add the import and constructor parameter:

```ts
import { ConfigService } from "@nestjs/config";
```

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly notifications: NotificationsService,
  private readonly config: ConfigService,
) {}
```

Replace `createEscrowHolding`'s body (remove the `releaseAfter` line):

```ts
async createEscrowHolding(
  orderId: string,
  amountCents: number,
  currency: string = "USD",
) {
  const existing = await this.prisma.escrowHolding.findUnique({
    where: { orderId },
  });

  if (existing) {
    throw new BadRequestException("Escrow already exists for this order");
  }

  const escrow = await this.prisma.escrowHolding.create({
    data: {
      orderId,
      amountCents,
      currency,
      status: "HOLDING",
    },
  });

  return escrow;
}
```

Add `startReleaseCountdown` as a new method (place it near `releaseEscrow`):

```ts
/**
 * Starts the auto-release countdown once delivery is confirmed, by either
 * the Shippo carrier webhook or the buyer's self-report endpoint.
 * Idempotent: safe to call from either trigger without double-counting.
 */
async startReleaseCountdown(orderId: string): Promise<void> {
  const escrow = await this.prisma.escrowHolding.findUnique({
    where: { orderId },
  });

  if (!escrow || escrow.status !== "HOLDING" || escrow.releaseAfter) {
    return;
  }

  const releaseDays = this.config.get<number>("ESCROW_AUTO_RELEASE_DAYS") ?? 5;
  const releaseAfter = new Date();
  releaseAfter.setDate(releaseAfter.getDate() + releaseDays);

  await this.prisma.escrowHolding.update({
    where: { id: escrow.id },
    data: { releaseAfter },
  });

  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });

  if (order && order.status !== "DELIVERED" && order.status !== "COMPLETED") {
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        timeline: {
          create: [
            {
              status: "DELIVERED",
              note: "Delivered — escrow release countdown started",
            },
          ],
        },
      },
    });
  }

  this.logger.log(
    `Escrow release countdown started for order ${orderId}: auto-releases at ${releaseAfter.toISOString()}`,
  );
}
```

- [ ] **Step 4: Update the shared `buildService` test helper for the new constructor parameter**

Task 1 defined `buildService` in `escrow.service.spec.ts` as `new EscrowService(prisma as never, notifications as never)`. Now that the constructor takes a third `ConfigService` parameter, every existing call to `buildService(prisma)` across Tasks 1's tests would otherwise break. Update the shared helper itself (defined once, near the top of the file, used by every `describe` block in this file including Task 1's):

```ts
function buildService(prisma: ReturnType<typeof buildPrismaMock>) {
  const notifications = {
    notifyEscrowReleased: jest.fn().mockResolvedValue(undefined),
  };
  const config = { get: () => 5 };
  return new EscrowService(
    prisma as never,
    notifications as never,
    config as never,
  );
}
```

(This replaces the two-argument version Task 1 wrote — a one-line diff. Do not add a second helper; keep a single `buildService` used by every test in the file, so future constructor changes only need updating in one place.)

- [ ] **Step 5: Update the `EscrowModule` for the new `ConfigService` dependency**

`apps/backend/src/modules/escrow/escrow.module.ts` needs `ConfigModule` added to `imports` (it's likely already implicitly available since `ConfigModule.forRoot({ isGlobal: true })` is configured in `app.module.ts`, but confirm by running the app-level test in Step 7 below — if it fails with a `ConfigService` resolution error, add `import { ConfigModule } from "@nestjs/config";` and add `ConfigModule` to the `imports` array).

In `apps/backend/src/modules/escrow/escrow.spec.ts`, the `buildApp` helper's `Test.createTestingModule` already imports `ConfigModule.forRoot({ isGlobal: true })` — no change needed there.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter backend exec jest escrow/escrow.service.spec.ts`
Expected: PASS (7 tests total: the 2 from Task 1 plus the 5 here)

- [ ] **Step 7: Run the full escrow test suite and backend typecheck**

Run: `pnpm --filter backend exec jest escrow`
Run: `pnpm --filter backend typecheck`
Expected: both PASS

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/escrow/escrow.service.ts apps/backend/src/modules/escrow/escrow.service.spec.ts apps/backend/src/modules/escrow/escrow.module.ts
git commit -m "fix(escrow): stop setting releaseAfter at creation; add startReleaseCountdown"
```

---

### Task 3: Wire the Shippo webhook to `startReleaseCountdown`, remove the dead inline logic

**Files:**

- Modify: `apps/backend/src/modules/orders/shippo-webhook.controller.ts`
- Modify: `apps/backend/src/modules/orders/orders.module.ts` (add `EscrowModule` to imports)

**Interfaces:**

- Consumes: `EscrowService.startReleaseCountdown(orderId: string)` from Task 2.

- [ ] **Step 1: Add `EscrowModule` to `OrdersModule`'s imports**

In `apps/backend/src/modules/orders/orders.module.ts`, add:

```ts
import { EscrowModule } from "../escrow/escrow.module";
```

and add `EscrowModule` to the `imports` array (alongside `PayoutsModule`, `FeesModule`, etc.). No circular-dependency risk: `EscrowModule` only imports `PrismaModule` and `NotificationsModule`.

- [ ] **Step 2: Inject `EscrowService` into `ShippoWebhookController` and replace the dead code**

Read `apps/backend/src/modules/orders/shippo-webhook.controller.ts`'s constructor first to see its current dependencies before editing (it already injects `PrismaService`, `ConfigService`, `NotificationsService`, and a `Logger` — add `EscrowService` alongside them).

Replace lines ~223–243 (the block starting `// Set escrow auto-release countdown...` through the `// TODO: register a scheduled job...` line) with:

```ts
// Start the auto-release countdown now that delivery is carrier-confirmed.
if (order.escrow) {
  await this.escrowService.startReleaseCountdown(orderId);
}
```

Remove the now-unused `EscrowStatus` import if `shippo-webhook.controller.ts` no longer references it after this change (check with a search for other `EscrowStatus` usages in the file before removing the import).

- [ ] **Step 3: Run the existing Shippo webhook tests**

Run: `pnpm --filter backend exec jest shippo-webhook`
Expected: PASS. If no test file exists for this controller yet, run `pnpm --filter backend exec jest orders` to confirm nothing else broke, and note the gap — this plan doesn't add new webhook-level tests for this path since Task 2's `startReleaseCountdown` unit tests already cover the underlying logic; the webhook controller change is a thin call-through.

- [ ] **Step 4: Run backend typecheck**

Run: `pnpm --filter backend typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/orders/shippo-webhook.controller.ts apps/backend/src/modules/orders/orders.module.ts
git commit -m "fix(orders): delegate delivery-confirmed escrow countdown to EscrowService"
```

---

### Task 4: Add the explicit delivery filter to `autoReleaseExpiredEscrows()`

**Files:**

- Modify: `apps/backend/src/modules/escrow/escrow.service.ts`
- Test: `apps/backend/src/modules/escrow/escrow.service.spec.ts`

**Interfaces:**

- No new public interface — this task hardens the existing `autoReleaseExpiredEscrows()`'s query.

- [ ] **Step 1: Write the failing regression test**

Add to `apps/backend/src/modules/escrow/escrow.service.spec.ts`:

```ts
describe("EscrowService.autoReleaseExpiredEscrows", () => {
  it("does not release an escrow whose order was never marked DELIVERED, even if releaseAfter is somehow set", async () => {
    const dueEscrow = {
      orderId: "order-never-delivered",
      id: "escrow-1",
      status: "HOLDING",
      releaseAfter: new Date(Date.now() - 1000),
      amountCents: 5000,
      currency: "USD",
    };
    const prisma = buildPrismaMock({
      escrowHolding: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          // Simulate a real Prisma filter: only return rows matching the
          // order.status filter this test is asserting exists.
          const orderStatus = "FULFILLED"; // never reached DELIVERED
          const allowedStatuses: string[] = where?.order?.status?.in ?? [];
          return allowedStatuses.includes(orderStatus) ? [dueEscrow] : [];
        }),
      },
    });
    const service = buildService(prisma);

    await service.autoReleaseExpiredEscrows();

    expect(prisma.escrowHolding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          order: { status: { in: ["DELIVERED", "COMPLETED"] } },
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter backend exec jest escrow/escrow.service.spec.ts -t "autoReleaseExpiredEscrows"`
Expected: FAIL — the current query has no `order` filter at all.

- [ ] **Step 3: Add the filter**

In `apps/backend/src/modules/escrow/escrow.service.ts`, modify the `where` clause inside `autoReleaseExpiredEscrows()`:

```ts
const due = await this.prisma.escrowHolding.findMany({
  where: {
    status: EscrowStatus.HOLDING,
    releaseAfter: { lte: now },
    order: { status: { in: ["DELIVERED", "COMPLETED"] } },
    disputes: {
      none: { status: { in: ["OPEN", "UNDER_REVIEW", "ESCALATED"] } },
    },
  },
  select: { orderId: true, id: true },
});
```

(Only the added `order: { status: { in: [...] } },` line changes — everything else in the method is unchanged.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter backend exec jest escrow/escrow.service.spec.ts -t "autoReleaseExpiredEscrows"`
Expected: PASS

- [ ] **Step 5: Run backend typecheck**

Run: `pnpm --filter backend typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/escrow/escrow.service.ts apps/backend/src/modules/escrow/escrow.service.spec.ts
git commit -m "fix(escrow): require order.status DELIVERED/COMPLETED in the auto-release sweep query"
```

---

### Task 5: Add the buyer "confirm delivery" endpoint

**Files:**

- Modify: `apps/backend/src/modules/orders/orders.service.ts`
- Modify: `apps/backend/src/modules/orders/orders.controller.ts`
- Test: `apps/backend/src/modules/orders/orders.flows.spec.ts`

**Interfaces:**

- Consumes: `EscrowService.startReleaseCountdown(orderId: string)` from Task 2.
- Produces: `OrdersService.confirmDelivery(orderId: string, buyerId: string): Promise<SafeOrder>`. `POST /orders/:id/confirm-delivery`.

- [ ] **Step 1: Inject `EscrowService` into `OrdersService`**

In `apps/backend/src/modules/orders/orders.service.ts`, add the import:

```ts
import { EscrowService } from "../escrow/escrow.service";
```

Add `private readonly escrowService: EscrowService,` to the constructor parameter list (after `private readonly shippingService: ShippingService,`).

- [ ] **Step 2: Write the failing test**

`orders.flows.spec.ts` bootstraps the real `OrdersModule` (which, after Task 3, imports `EscrowModule`) against a hand-written `InMemoryPrismaService` — no separate escrow mock is needed; the same `prismaMock` instance backs both. The existing seeded `paidOrder`/`paidEscrow` fixture (status `PAID`, escrow `HOLDING`, `BUYER_ID`/`SELLER_ID`) is reused below — find its order id the same way the existing "runs the pay → fulfill → release happy path" test does (by looking up the seeded order number via `GET /orders`, or by reading `prismaMock`'s seeded id directly if the file exposes one — check the top of the "happy path" test for how it obtains `orderId` before writing this).

Add a new `describe` block (place it after the existing "runs the pay → fulfill → release happy path" test):

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter backend exec jest orders.flows.spec.ts -t "confirm-delivery"`
Expected: FAIL — the endpoint doesn't exist yet (404).

- [ ] **Step 4: Add `confirmDelivery` to `OrdersService`**

Add this method to `apps/backend/src/modules/orders/orders.service.ts` (near `findById` or other single-order operations):

```ts
async confirmDelivery(orderId: string, buyerId: string): Promise<SafeOrder> {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    select: { buyerId: true, status: true },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  if (order.buyerId !== buyerId) {
    throw new ForbiddenException("Only the buyer can confirm delivery");
  }

  if (order.status !== OrderStatus.FULFILLED && order.status !== OrderStatus.DELIVERED) {
    throw new BadRequestException(
      `Cannot confirm delivery for an order in status ${order.status}`,
    );
  }

  await this.escrowService.startReleaseCountdown(orderId);

  const updated = (await this.prisma.order.findUnique({
    where: { id: orderId },
    include: this.defaultInclude,
  })) as OrderWithRelations;

  return serializeOrder(updated);
}
```

- [ ] **Step 5: Add the controller endpoint**

In `apps/backend/src/modules/orders/orders.controller.ts`, add (placed near the existing `:id/release` endpoint):

```ts
@Post(":id/confirm-delivery")
@HttpCode(HttpStatus.OK)
async confirmDelivery(
  @Param("id") id: string,
  @Request() req: { user: { id: string } },
): Promise<SafeOrder> {
  return this.ordersService.confirmDelivery(id, req.user.id);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter backend exec jest orders.flows.spec.ts -t "confirm-delivery"`
Expected: PASS

- [ ] **Step 7: Run the full orders suite and backend typecheck**

Run: `pnpm --filter backend exec jest orders`
Run: `pnpm --filter backend typecheck`
Expected: both PASS

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/orders/orders.service.ts apps/backend/src/modules/orders/orders.controller.ts apps/backend/src/modules/orders/orders.flows.spec.ts
git commit -m "feat(orders): add buyer-facing confirm-delivery endpoint"
```

---

### Task 6: Consolidate `handleEscrowRelease()` into `EscrowService.releaseEscrow()`

**Files:**

- Modify: `apps/backend/src/modules/orders/orders.service.ts`
- Modify: `apps/backend/src/modules/orders/orders.module.ts` (if `EscrowModule` isn't already imported by Task 3 in this execution order — it is, so no change needed here)
- Test: `apps/backend/src/modules/orders/orders.flows.spec.ts`

**Interfaces:**

- Consumes: `EscrowService.releaseEscrow(orderId, actorId, note, client)` from Task 1.

- [ ] **Step 1: Write the failing regression test**

Add to `apps/backend/src/modules/orders/orders.flows.spec.ts`. This test doesn't need an `EscrowDispute` row — `handleEscrowRelease`'s guard operates on the `EscrowHolding.status` field itself (set to `DISPUTED` when a dispute opens, per `EscrowService.openDispute()`), so seeding the escrow directly at `DISPUTED` via the exposed `escrowHolding` test-double methods reproduces the real precondition:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter backend exec jest orders.flows.spec.ts -t "open dispute"`
Expected: FAIL — the current `handleEscrowRelease` accepts `status: { in: ["HOLDING", "DISPUTED"] }`, so this currently succeeds (200), not 400.

- [ ] **Step 3: Replace `handleEscrowRelease()`'s body**

In `apps/backend/src/modules/orders/orders.service.ts`, replace the full body of `handleEscrowRelease` (currently lines 1215–1278, from `const escrow = order.escrow ?? ...` through the closing `}` after the `auditLog.create` call) with a call into `EscrowService.releaseEscrow()`, passing the transaction client through to preserve atomicity with the order-status update:

```ts
private async handleEscrowRelease(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    escrow: {
      id: string;
      status: EscrowStatus;
      amountCents: number;
      currency: string;
    } | null;
  },
  dto: UpdateOrderStatusInput,
): Promise<void> {
  if (!order.escrow) {
    return;
  }
  await this.escrowService.releaseEscrow(
    order.id,
    dto.actorId ?? "system",
    dto.note,
    tx,
  );
}
```

This removes the duplicate atomic `updateMany`, the duplicate `escrowTransaction.create`, and the duplicate `auditLog.create` (now written once, inside `releaseEscrow()`, for every release path — cron, admin, and this buyer path alike). The `EscrowTransactionType` import in `orders.service.ts` may now be unused by this method specifically — check for other usages in the file before removing the import (it's also used in `handleEscrowRefund`, so it will very likely still be needed; do not remove it without confirming).

Note the behavior change this produces (expected and beneficial, not a bug): the seller now receives a `notifyEscrowReleased` email when a buyer releases via this endpoint, matching what already happens on cron/admin release — previously this path sent no such notification.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter backend exec jest orders.flows.spec.ts -t "open dispute"`
Expected: PASS

- [ ] **Step 5: Run the full orders suite and backend typecheck**

Run: `pnpm --filter backend exec jest orders`
Run: `pnpm --filter backend typecheck`
Expected: both PASS. If any existing test in `orders.flows.spec.ts` asserted the old `"Escrow released to seller"` hardcoded note text or checked for an `EscrowTransactionType.RELEASE` write with the old inline shape, update its expectation to match `releaseEscrow()`'s note default (`"Funds released to seller"`) or the note passed through from `dto.note`.

- [ ] **Step 6: Confirm the atomicity limitation — no test to write here**

`orders.flows.spec.ts`'s `InMemoryPrismaService.$transaction` is
`async $transaction(fn) { return fn(this); }` (line 993) — it has no
rollback capability at all; it's a plain pass-through. A test against
this double cannot prove real commit/rollback atomicity, only that
`handleEscrowRelease` is invoked with the same `tx` reference
`applyStatusUpdate` uses (which is trivially true by construction — the
code passes `tx` as a parameter, there's only one `tx` object in scope).
Writing a test that would only prove that would be circular and add no
real coverage, so skip adding one here. Instead:

- Verify by reading, not testing: confirm `handleEscrowRelease(tx, ...)` in the modified `orders.service.ts` still receives and passes through the same `tx` parameter `applyStatusUpdate`'s `$transaction` callback provides — this is what Step 3 already implements; no separate verification step needed beyond Step 4's passing test.
- Record this as a known gap in the Final Verification report at the end of this plan: true rollback-on-partial-failure atomicity for the consolidated `handleEscrowRelease` is architecturally correct (same `tx` object, same Postgres transaction) but not covered by an automated test in this codebase, since doing so needs a real Postgres integration test rather than the in-memory fakes this backend's unit/component tests use.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/orders/orders.service.ts apps/backend/src/modules/orders/orders.flows.spec.ts
git commit -m "fix(orders): consolidate handleEscrowRelease into EscrowService.releaseEscrow, blocking release while disputed"
```

---

### Task 7: Fix the `processPayout()` PENDING→PROCESSING race

**Files:**

- Modify: `apps/backend/src/modules/payouts/payouts.service.ts`
- Test: `apps/backend/src/modules/payouts/payouts.service.spec.ts`

**Interfaces:**

- No signature change to `processPayout(payoutId: string): Promise<void>` — only its internal state-transition guard changes.

- [ ] **Step 1: Write the failing concurrency test**

Add to `apps/backend/src/modules/payouts/payouts.service.spec.ts`:

```ts
describe("PayoutsService.processPayout concurrency", () => {
  function createProcessPayoutService() {
    const payoutRow = {
      id: "payout-1",
      status: "PENDING",
      amount: 10_000,
      currency: "usd",
      sellerId: "seller-1",
      seller: {
        id: "seller-1",
        stripeConnectAccountId: null,
        stripeConnectOnboarded: false,
        profile: null,
      },
    };
    let currentStatus = "PENDING";
    const prisma = {
      payout: {
        findUnique: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve({ ...payoutRow, status: currentStatus }),
          ),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          if (where.status !== currentStatus)
            return Promise.resolve({ count: 0 });
          currentStatus = data.status;
          return Promise.resolve({ count: 1 });
        }),
        count: jest.fn().mockResolvedValue(5),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ createdAt: new Date(0) }),
      },
    };
    const service = new PayoutsService(
      prisma as never,
      {} as never,
      {} as never,
    );
    return { prisma, service };
  }

  it("only one of two concurrent calls succeeds in claiming a PENDING payout", async () => {
    const { prisma, service } = createProcessPayoutService();

    const results = await Promise.allSettled([
      service.processPayout("payout-1"),
      service.processPayout("payout-1"),
    ]);

    const claimAttempts = prisma.payout.updateMany.mock.calls.filter(
      ([args]: [{ data: { status: string } }]) =>
        args.data.status === "PROCESSING",
    );
    const successfulClaims = prisma.payout.updateMany.mock.results.filter(
      (r: { value: Promise<{ count: number }> }) => {
        // Both calls resolve synchronously in this mock; count how many
        // actually returned count: 1 across the two invocations.
        return true;
      },
    );
    expect(claimAttempts.length).toBe(2);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected.length).toBeGreaterThanOrEqual(1);
  });
});
```

(Note: this mock's `updateMany` is synchronous-resolving, so it does not perfectly simulate a real database race — it proves the _code path_ rejects a second claim attempt against an already-`PROCESSING` row, which is the actual guarantee this fix provides. A true concurrent-race test would require an integration test against a real Postgres instance, which is out of scope for this unit-level plan.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter backend exec jest payouts.service.spec.ts -t "concurrent"`
Expected: FAIL — `processPayout` currently uses a plain `update`, so `prisma.payout.updateMany` is never called with `status: "PROCESSING"` at all.

- [ ] **Step 3: Fix `processPayout()`**

In `apps/backend/src/modules/payouts/payouts.service.ts`, replace:

```ts
// Mark PROCESSING before calling provider to prevent double-processing
await this.prisma.payout.update({
  where: { id: payoutId },
  data: { status: PayoutStatus.PROCESSING },
});
```

with:

```ts
// Atomic conditional update — only one concurrent caller can claim this
// payout; the loser gets a clean rejection instead of both proceeding
// to call the payment provider.
const claimed = await this.prisma.payout.updateMany({
  where: { id: payoutId, status: PayoutStatus.PENDING },
  data: { status: PayoutStatus.PROCESSING },
});
if (claimed.count === 0) {
  throw new BadRequestException(
    `Payout ${payoutId} is not PENDING (already claimed by a concurrent call)`,
  );
}
```

This sits after the existing `payout.status !== PayoutStatus.PENDING` check earlier in the method — that check remains as a fast-path rejection for the common (non-racing) case; this new atomic claim is the actual concurrency guard.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter backend exec jest payouts.service.spec.ts -t "concurrent"`
Expected: PASS

- [ ] **Step 5: Run the full payouts suite and backend typecheck**

Run: `pnpm --filter backend exec jest payouts`
Run: `pnpm --filter backend typecheck`
Expected: both PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/payouts/payouts.service.ts apps/backend/src/modules/payouts/payouts.service.spec.ts
git commit -m "fix(payouts): make the PENDING->PROCESSING transition an atomic conditional update"
```

---

### Task 8: Add the admin retry-failed-payout endpoint

**Files:**

- Modify: `apps/backend/src/modules/payouts/payouts.service.ts`
- Modify: `apps/backend/src/modules/payouts/payouts.controller.ts`
- Test: `apps/backend/src/modules/payouts/payouts.service.spec.ts`

**Interfaces:**

- Produces: `PayoutsService.retryFailedPayout(payoutId: string, actorId: string): Promise<void>`. `POST /payouts/admin/:payoutId/retry`, `ADMIN`-only.

- [ ] **Step 1: Write the failing tests**

Add to `apps/backend/src/modules/payouts/payouts.service.spec.ts`:

```ts
describe("PayoutsService.retryFailedPayout", () => {
  function createService(payout: Record<string, unknown> | null) {
    const prisma = {
      payout: {
        findUnique: jest.fn().mockResolvedValue(payout),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const auditLogService = { record: jest.fn().mockResolvedValue({}) };
    return {
      prisma,
      auditLogService,
      service: new PayoutsService(
        prisma as never,
        {} as never,
        {} as never,
        auditLogService as never,
      ),
    };
  }

  it("rejects retrying a payout that is not FAILED", async () => {
    const { service } = createService({ id: "payout-1", status: "PENDING" });

    await expect(
      service.retryFailedPayout("payout-1", "admin-1"),
    ).rejects.toThrow(/not FAILED/);
  });

  it("resets a FAILED payout to PENDING, clears failureReason, preserves retryCount", async () => {
    const { prisma, auditLogService, service } = createService({
      id: "payout-1",
      status: "FAILED",
      failureReason: "card declined",
      retryCount: 1,
    });

    await service.retryFailedPayout("payout-1", "admin-1");

    expect(prisma.payout.updateMany).toHaveBeenCalledWith({
      where: { id: "payout-1", status: "FAILED" },
      data: { status: "PENDING", failureReason: null },
    });
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "payout.retry",
        entityType: "payout",
        entityId: "payout-1",
      }),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter backend exec jest payouts.service.spec.ts -t "retryFailedPayout"`
Expected: FAIL — the method and the `AuditLogService` constructor parameter don't exist yet.

- [ ] **Step 3: Inject `AuditLogService` and implement `retryFailedPayout`**

`AuditLogService` lives in `ObservabilityModule`, which is `@Global()` — no module import change is needed in `payouts.module.ts`, only the constructor injection.

In `apps/backend/src/modules/payouts/payouts.service.ts`, add the import:

```ts
import { AuditLogService } from "../observability/audit-log.service";
```

Add `private readonly auditLog: AuditLogService,` to the constructor parameter list.

Add this method (near `processPayout`):

```ts
async retryFailedPayout(payoutId: string, actorId: string): Promise<void> {
  const payout = await this.prisma.payout.findUnique({
    where: { id: payoutId },
  });
  if (!payout) {
    throw new NotFoundException(`Payout ${payoutId} not found`);
  }
  if (payout.status !== PayoutStatus.FAILED) {
    throw new BadRequestException(
      `Payout ${payoutId} is not FAILED (currently ${payout.status})`,
    );
  }

  await this.prisma.payout.updateMany({
    where: { id: payoutId, status: PayoutStatus.FAILED },
    data: { status: PayoutStatus.PENDING, failureReason: null },
  });

  await this.auditLog.record({
    actorId,
    action: "payout.retry",
    entityType: "payout",
    entityId: payoutId,
  });

  this.logger.log(`retryFailedPayout: payout ${payoutId} reset to PENDING by ${actorId}`);
}
```

- [ ] **Step 4: Add the controller endpoint**

In `apps/backend/src/modules/payouts/payouts.controller.ts`, add (near the existing `admin/process` endpoint):

```ts
@Post("admin/:payoutId/retry")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
@HttpCode(HttpStatus.OK)
@ApiOperation({
  summary: "(Admin) Reset a FAILED payout back to PENDING for retry",
})
async adminRetryPayout(
  @Param("payoutId") payoutId: string,
  @Req() req: AuthRequest,
): Promise<{ success: boolean }> {
  await this.payoutsService.retryFailedPayout(payoutId, req.user.id);
  return { success: true };
}
```

- [ ] **Step 5: Fix the pre-existing `createService` helper's now-outdated constructor call**

`payouts.service.spec.ts` already has a `createService` helper (used by the pre-existing "PayoutsService legacy payout reconciliation" tests) that builds `new PayoutsService(prisma as never, {} as never, {} as never)` with 3 arguments. `PayoutsService` now requires a 4th `AuditLogService` argument — this helper must be updated or those existing tests fail to compile. Change it to:

```ts
return {
  prisma,
  service: new PayoutsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  ),
};
```

(Only the constructor call's argument list changes — the rest of `createService` and its existing two tests are unaffected, since they don't exercise `retryFailedPayout`.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter backend exec jest payouts.service.spec.ts -t "retryFailedPayout"`
Expected: PASS

- [ ] **Step 7: Run the full payouts suite and backend typecheck**

Run: `pnpm --filter backend exec jest payouts`
Run: `pnpm --filter backend typecheck`
Expected: both PASS — this also confirms the pre-existing "legacy payout reconciliation" tests still pass with the updated helper.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/payouts/payouts.service.ts apps/backend/src/modules/payouts/payouts.controller.ts apps/backend/src/modules/payouts/payouts.service.spec.ts
git commit -m "feat(payouts): add admin endpoint to retry a FAILED payout"
```

---

### Task 9: Instrument escrow/payout outcomes with the existing `backgroundJobsProcessed` metric

**Files:**

- Modify: `apps/backend/src/modules/escrow/escrow.service.ts`
- Modify: `apps/backend/src/modules/payouts/payouts.service.ts`
- Test: `apps/backend/src/modules/escrow/escrow.service.spec.ts`, `apps/backend/src/modules/payouts/payouts.service.spec.ts`

**Interfaces:**

- Consumes: `metrics.backgroundJobsProcessed` (a `prom-client` `Counter` with `labelNames: ["job", "status"]`) from `apps/backend/src/telemetry/metrics.ts` — no changes to that file.

- [ ] **Step 1: Write the failing tests**

Add to `apps/backend/src/modules/escrow/escrow.service.spec.ts`:

```ts
import { metrics } from "../../telemetry/metrics";

describe("EscrowService.autoReleaseExpiredEscrows metrics", () => {
  it("increments backgroundJobsProcessed with job=escrow_auto_release, status=released on success", async () => {
    const incSpy = jest.spyOn(metrics.backgroundJobsProcessed, "inc");
    const dueEscrow = { orderId: "order-1", id: "escrow-1" };
    const prisma = buildPrismaMock({
      escrowHolding: {
        findMany: jest.fn().mockResolvedValue([dueEscrow]),
        findUnique: jest.fn().mockResolvedValue({
          id: "escrow-1",
          orderId: "order-1",
          status: "HOLDING",
          amountCents: 5000,
          currency: "USD",
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ seller: { email: "s@test.com", name: "S" } }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderTimelineEvent: { create: jest.fn().mockResolvedValue({}) },
    });
    const service = buildService(prisma);

    await service.autoReleaseExpiredEscrows();

    expect(incSpy).toHaveBeenCalledWith({
      job: "escrow_auto_release",
      status: "released",
    });
    incSpy.mockRestore();
  });
});
```

Add to `apps/backend/src/modules/payouts/payouts.service.spec.ts`:

```ts
import { metrics } from "../../telemetry/metrics";

describe("PayoutsService metrics", () => {
  it("increments backgroundJobsProcessed with job=payout_process, status=succeeded on success", async () => {
    const incSpy = jest.spyOn(metrics.backgroundJobsProcessed, "inc");
    const prisma = {
      payout: {
        findUnique: jest.fn().mockResolvedValue({
          id: "payout-1",
          status: "PENDING",
          amount: 10_000,
          currency: "usd",
          seller: {
            id: "seller-1",
            stripeConnectAccountId: "acct_1",
            stripeConnectOnboarded: true,
            profile: null,
          },
        }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(5),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ createdAt: new Date(0) }),
      },
    };
    const stripeTransfersCreate = jest.fn().mockResolvedValue({ id: "tr_1" });
    // 4 constructor args as of Task 8's AuditLogService injection.
    const service = new PayoutsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    (service as unknown as { stripe: unknown }).stripe = {
      transfers: { create: stripeTransfersCreate },
    };

    await service.processPayout("payout-1");

    expect(incSpy).toHaveBeenCalledWith({
      job: "payout_process",
      status: "succeeded",
    });
    incSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter backend exec jest escrow/escrow.service.spec.ts payouts.service.spec.ts -t "metrics"`
Expected: FAIL — neither method calls `metrics.backgroundJobsProcessed.inc` yet.

- [ ] **Step 3: Instrument `EscrowService.autoReleaseExpiredEscrows()`**

In `apps/backend/src/modules/escrow/escrow.service.ts`, add the import:

```ts
import { metrics } from "../../telemetry/metrics";
```

Inside the `for (const escrow of due)` loop's `try` block, after the existing `orderTimelineEvent.create` call, add:

```ts
metrics.backgroundJobsProcessed.inc({
  job: "escrow_auto_release",
  status: "released",
});
```

In the loop's `catch` block, after the existing `this.logger.error(...)` call, add:

```ts
metrics.backgroundJobsProcessed.inc({
  job: "escrow_auto_release",
  status: "failed",
});
```

- [ ] **Step 4: Instrument `PayoutsService`**

In `apps/backend/src/modules/payouts/payouts.service.ts`, add the import:

```ts
import { metrics } from "../../telemetry/metrics";
```

In `schedulePayouts()`, inside the `for (const escrow of eligible)` loop:

- After the existing `if (netAmount < MINIMUM_PAYOUT_CENTS) { ...; continue; }` block's `this.logger.warn` call, add `metrics.backgroundJobsProcessed.inc({ job: "payout_schedule", status: "skipped_below_minimum" });`.
- After the existing legacy-conflict `this.logger.warn` call (the `legacyPayoutKeys.has(...)` branch), add `metrics.backgroundJobsProcessed.inc({ job: "payout_schedule", status: "skipped_legacy_conflict" });`.
- After the `newPayouts.push(...)` call, add `metrics.backgroundJobsProcessed.inc({ job: "payout_schedule", status: "created" });`.

In `processPayout()`:

- After the try block's provider dispatch succeeds (i.e. after the `if/else` calling `processStripePayout`/`processPaystackPayout` completes without throwing — add this as the last line before the method's closing `try` block ends, right before the `catch`), add `metrics.backgroundJobsProcessed.inc({ job: "payout_process", status: "succeeded" });`.
- In the `catch` block, after the existing `this.prisma.payout.update({ ...status: FAILED... })` call, add `metrics.backgroundJobsProcessed.inc({ job: "payout_process", status: "failed" });`.

In `retryFailedPayout()` (Task 8), after the `this.auditLog.record(...)` call, add:

```ts
metrics.backgroundJobsProcessed.inc({
  job: "payout_process",
  status: "retried",
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter backend exec jest escrow/escrow.service.spec.ts payouts.service.spec.ts -t "metrics"`
Expected: PASS

- [ ] **Step 6: Run the full backend test suite and typecheck**

Run: `pnpm --filter backend test`
Run: `pnpm --filter backend typecheck`
Expected: both PASS, with no regressions in any other suite.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/escrow/escrow.service.ts apps/backend/src/modules/escrow/escrow.service.spec.ts apps/backend/src/modules/payouts/payouts.service.ts apps/backend/src/modules/payouts/payouts.service.spec.ts
git commit -m "feat(observability): instrument escrow auto-release and payout outcomes with backgroundJobsProcessed"
```

---

## Final Verification

After all 9 tasks are complete:

- [ ] Run `pnpm --filter backend test` — full backend suite passes.
- [ ] Run `pnpm --filter backend typecheck` — clean.
- [ ] Run `pnpm --filter backend lint` — clean.
- [ ] Run `pnpm typecheck` from the repo root — all packages clean (this plan touches only backend code, but confirm nothing else broke).
- [ ] Re-read `docs/superpowers/specs/2026-08-23-escrow-auto-release-hardening-design.md` end to end and confirm every numbered decision (1–9) and every design section (1–8) maps to a completed task above.
- [ ] Update `docs/ROADMAP.md`'s RR-013 checklist items to `[x]` with brief notes on what was verified, following the same style already used for RR-001 through RR-012 in that file.
- [ ] Report back to the Project Owner with a summary of what changed, what was tested, and any residual risk (e.g. the atomicity test in Task 6 Step 6 may only prove call-ordering rather than true rollback semantics, depending on what the existing test double supports — call this out explicitly, don't let it pass silently as "fully verified" if it wasn't).
