import { OrderStatus, ReturnStatus } from "@prisma/client";

import { ReturnsService } from "./returns.service";

describe("ReturnsService provider-confirmed refunds", () => {
  it("does not persist terminal return state until the order refund is confirmed", async () => {
    const fixture = createRefundFixture();
    fixture.ordersService.requestRefund.mockImplementation(async () => {
      expect(fixture.state.returnStatus).toBe(ReturnStatus.received);
      return { status: OrderStatus.REFUNDED };
    });

    const result = await fixture.service.forceRefund(fixture.state.returnId);

    expect(fixture.ordersService.requestRefund).toHaveBeenCalledWith(
      fixture.state.orderId,
      {
        status: OrderStatus.REFUNDED,
        note: `Return refund — return ${fixture.state.returnId}`,
      },
    );
    expect(result.status).toBe(ReturnStatus.refunded);
    expect(fixture.prisma.return.update).toHaveBeenCalledTimes(1);
  });

  it.each([OrderStatus.REFUND_FAILED, OrderStatus.REFUND_PENDING])(
    "keeps a provider refund in %s nonterminal and retryable",
    async (refundStatus) => {
      const fixture = createRefundFixture();
      fixture.ordersService.requestRefund.mockResolvedValue({
        status: refundStatus,
      });

      const result = await fixture.service.forceRefund(fixture.state.returnId);

      expect(result.status).toBe(ReturnStatus.received);
      expect(fixture.prisma.return.update).not.toHaveBeenCalled();
      expect(fixture.ordersService.requestRefund).toHaveBeenCalledTimes(1);
    },
  );

  it("retries through the same idempotent order path and completes the return exactly once", async () => {
    const fixture = createRefundFixture();
    fixture.ordersService.requestRefund
      .mockResolvedValueOnce({ status: OrderStatus.REFUND_FAILED })
      .mockResolvedValueOnce({ status: OrderStatus.REFUNDED });

    const failedResult = await fixture.service.forceRefund(
      fixture.state.returnId,
    );
    const confirmedResult = await fixture.service.forceRefund(
      fixture.state.returnId,
    );

    const expectedRequest = [
      fixture.state.orderId,
      {
        status: OrderStatus.REFUNDED,
        note: `Return refund — return ${fixture.state.returnId}`,
      },
    ] as const;
    expect(failedResult.status).toBe(ReturnStatus.received);
    expect(fixture.ordersService.requestRefund).toHaveBeenNthCalledWith(
      1,
      ...expectedRequest,
    );
    expect(fixture.ordersService.requestRefund).toHaveBeenNthCalledWith(
      2,
      ...expectedRequest,
    );
    expect(confirmedResult.status).toBe(ReturnStatus.refunded);
    expect(fixture.prisma.return.update).toHaveBeenCalledTimes(1);
  });
});

function createRefundFixture() {
  const state: {
    returnId: string;
    orderId: string;
    returnStatus: ReturnStatus;
    resolvedAt: Date | null;
  } = {
    returnId: "return-provider-confirmation",
    orderId: "order-provider-confirmation",
    returnStatus: ReturnStatus.received,
    resolvedAt: null,
  };

  const buildReturn = () => ({
    id: state.returnId,
    orderId: state.orderId,
    buyerId: "buyer-refund",
    sellerId: "seller-refund",
    status: state.returnStatus,
    reason: "not_as_described",
    description: null,
    evidenceUrls: [],
    sellerResponse: null,
    rejectionReason: null,
    refundAmount: 4200,
    returnTrackingNumber: null,
    returnCarrier: null,
    requestedAt: new Date("2026-08-20T10:00:00.000Z"),
    respondedAt: null,
    shippedAt: new Date("2026-08-20T11:00:00.000Z"),
    receivedAt: new Date("2026-08-20T12:00:00.000Z"),
    resolvedAt: state.resolvedAt,
    autoApproveAt: null,
    createdAt: new Date("2026-08-20T10:00:00.000Z"),
    updatedAt: new Date("2026-08-20T12:00:00.000Z"),
    order: {
      id: state.orderId,
      orderNumber: "ORD-REFUND-CONFIRMATION",
      deliveredAt: new Date("2026-08-19T12:00:00.000Z"),
      totalItemCents: 4200,
      currency: "USD",
      escrow: { id: "escrow-provider-confirmation", amountCents: 4200 },
    },
    buyer: { id: "buyer-refund", name: "Buyer", email: "buyer@example.test" },
    seller: {
      id: "seller-refund",
      name: "Seller",
      email: "seller@example.test",
    },
  });

  const prisma = {
    return: {
      findUnique: jest.fn(async () => buildReturn()),
      findUniqueOrThrow: jest.fn(async () => buildReturn()),
      update: jest.fn(
        async ({
          data,
        }: {
          data: { status?: ReturnStatus; resolvedAt?: Date };
        }) => {
          if (data.status !== undefined) state.returnStatus = data.status;
          if (data.resolvedAt !== undefined) state.resolvedAt = data.resolvedAt;
          return buildReturn();
        },
      ),
    },
  };
  const notifications = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
    createInApp: jest.fn().mockResolvedValue(undefined),
  };
  const ordersService = {
    requestRefund: jest.fn(),
  };

  return {
    state,
    prisma,
    ordersService,
    service: new ReturnsService(
      prisma as never,
      notifications as never,
      ordersService as never,
    ),
  };
}
