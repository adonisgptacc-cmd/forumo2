import { Prisma } from "@prisma/client";
import { EscrowService } from "./escrow.service";
import { metrics } from "../../telemetry/metrics";

function buildBasePrismaMock() {
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
  };
}

// Overloaded (rather than a single generic with a default type parameter)
// so each call site's override object determines the accessible shape on
// its own terms — e.g. adding order.update, orderTimelineEvent.create — via
// direct inference from that call's argument, instead of every call sharing
// one inferred/defaulted instantiation. This keeps the base mock's own
// properties type-checked everywhere, without falling back to a bare `any`
// that would erase compile-time shape checking for every test in this file.
function buildPrismaMock(): ReturnType<typeof buildBasePrismaMock>;
function buildPrismaMock<O extends Record<string, unknown>>(
  overrides: O,
): Omit<ReturnType<typeof buildBasePrismaMock>, keyof O> & O;
function buildPrismaMock<O extends Record<string, unknown>>(overrides?: O) {
  const base = buildBasePrismaMock();
  return { ...base, ...(overrides ?? {}) };
}

// Generic (rather than typed via `ReturnType<typeof buildPrismaMock>`) so
// each test's own `prisma` variable — already precisely typed by its own
// buildPrismaMock(...) call above — flows through unchanged, instead of
// every call site being forced through one shared instantiation.
function buildService<P>(prisma: P) {
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
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockResolvedValue({}),
      },
      orderTimelineEvent: { create: jest.fn().mockResolvedValue({}) },
    });
    const service = buildService(prisma);

    await service.startReleaseCountdown("order-1");

    expect(prisma.escrowHolding.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order-1", status: "HOLDING", releaseAfter: null },
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
        updateMany: jest.fn(),
      },
      order: { findUnique: jest.fn(), update: jest.fn() },
    });
    const service = buildService(prisma);

    await service.startReleaseCountdown("order-1");

    expect(prisma.escrowHolding.updateMany).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("is a no-op when there is no HOLDING escrow for the order", async () => {
    const prisma = buildPrismaMock({
      escrowHolding: {
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
      },
    });
    const service = buildService(prisma);

    await service.startReleaseCountdown("order-nonexistent");

    expect(prisma.escrowHolding.updateMany).not.toHaveBeenCalled();
  });

  it("is a no-op when the atomic updateMany loses the race (count: 0)", async () => {
    const prisma = buildPrismaMock({
      escrowHolding: {
        findUnique: jest.fn().mockResolvedValue({
          id: "escrow-1",
          orderId: "order-1",
          status: "HOLDING",
          releaseAfter: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      order: { findUnique: jest.fn(), update: jest.fn() },
    });
    const service = buildService(prisma);

    await service.startReleaseCountdown("order-1");

    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("only applies the DELIVERED side effects once when two calls race for the same order", async () => {
    // Mirrors escrow.spec.ts's InMemoryPrismaService.escrowHolding.updateMany
    // pattern: a stateful mock that tracks whether the row has already been
    // claimed, so the first concurrent caller wins (count: 1) and any
    // subsequent caller loses the race (count: 0).
    let claimed = false;
    const updateMany = jest.fn().mockImplementation(async () => {
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    });
    const orderUpdate = jest.fn().mockResolvedValue({});
    const prisma = buildPrismaMock({
      escrowHolding: {
        findUnique: jest.fn().mockResolvedValue({
          id: "escrow-1",
          orderId: "order-1",
          status: "HOLDING",
          releaseAfter: null,
        }),
        updateMany,
      },
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "order-1", status: "FULFILLED" }),
        update: orderUpdate,
      },
      orderTimelineEvent: { create: jest.fn().mockResolvedValue({}) },
    });
    const service = buildService(prisma);

    await Promise.all([
      service.startReleaseCountdown("order-1"),
      service.startReleaseCountdown("order-1"),
    ]);

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(orderUpdate).toHaveBeenCalledTimes(1);
  });
});

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
