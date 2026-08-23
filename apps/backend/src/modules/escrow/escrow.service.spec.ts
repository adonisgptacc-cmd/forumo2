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
