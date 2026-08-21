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
