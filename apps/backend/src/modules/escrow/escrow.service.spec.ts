import { Prisma } from "@prisma/client";
import { EscrowService } from "./escrow.service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- overrides can extend/replace any nested mock shape (e.g. add order.update, orderTimelineEvent). Returning `any` lets each test's override object determine the accessible shape instead of the base literal's narrower inferred type.
function buildPrismaMock(overrides: Record<string, any> = {}): any {
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
