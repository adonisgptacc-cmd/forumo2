import { PayoutsService } from "./payouts.service";

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
      service: new PayoutsService(prisma as never, {} as never, {} as never),
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
