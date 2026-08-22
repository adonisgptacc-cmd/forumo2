import { LegalService } from "./legal.service";

describe("LegalService", () => {
  it("records TOS acceptance and provenance in one transaction", async () => {
    const events: string[] = [];
    const transactionClient = {
      user: {
        update: jest.fn().mockImplementation(async () => {
          events.push("user-updated");
        }),
      },
    };
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: "user-1" }),
        update: jest.fn(),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<void>) =>
          callback(transactionClient),
      ),
    };
    const auditLog = {
      record: jest.fn().mockImplementation(async () => {
        events.push("audit-recorded");
      }),
    };
    const service = new LegalService(
      prisma as never,
      {} as never,
      {} as never,
      auditLog as never,
    );

    await service.acceptTos(
      "user-1",
      "2026-08-16",
      "203.0.113.20",
      "ForumoMobile/1.0",
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(auditLog.record).toHaveBeenCalledWith(
      {
        actorId: "user-1",
        action: "legal.tos.accepted",
        entityType: "user",
        entityId: "user-1",
        payload: { version: "2026-08-16" },
        ipAddress: "203.0.113.20",
        userAgent: "ForumoMobile/1.0",
      },
      transactionClient,
    );
    expect(events).toEqual(["user-updated", "audit-recorded"]);
  });
});
