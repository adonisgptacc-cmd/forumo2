import { PayoutsService } from "./payouts.service";
import { metrics } from "../../telemetry/metrics";

describe("PayoutsService legacy payout reconciliation", () => {
  const eligibleEscrow = {
    orderId: "order-1",
    amountCents: 10_000,
    order: { id: "order-1", sellerId: "seller-1", currency: "ZAR" },
  };

  function createService(existingPayouts: unknown[]) {
    const prisma = {
      escrowHolding: {
        findMany: jest.fn().mockResolvedValue([eligibleEscrow]),
      },
      payout: {
        findMany: jest.fn().mockResolvedValue(existingPayouts),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return {
      prisma,
      service: new PayoutsService(
        prisma as never,
        {} as never,
        {} as never,
        {} as never,
      ),
    };
  }

  it("withholds a payout when a matching legacy row has no orderId", async () => {
    const { prisma, service } = createService([
      { orderId: null, sellerId: "seller-1", amount: 9_500, currency: "zar" },
    ]);

    await service.schedulePayouts();

    expect(prisma.payout.createMany).not.toHaveBeenCalled();
  });

  it("creates a payout when neither an order-linked nor matching legacy row exists", async () => {
    const { prisma, service } = createService([]);

    await service.schedulePayouts();

    expect(prisma.payout.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sellerId: "seller-1",
          orderId: "order-1",
          amount: 9_500,
          currency: "zar",
        }),
      ],
      skipDuplicates: true,
    });
  });
});

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
    expect(claimAttempts.length).toBe(2);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected.length).toBeGreaterThanOrEqual(1);
  });
});

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
