import { NotFoundException } from "@nestjs/common";
import { PaymentProvider, PaymentStatus } from "@prisma/client";

import { OrdersService } from "./orders.service";

describe("OrdersService Paystack verification authorization", () => {
  it("checks order ownership before contacting Paystack or mutating payment state", async () => {
    const payment = {
      id: "payment-paystack-foreign",
      orderId: "order-paystack-foreign",
      provider: PaymentProvider.PAYSTACK,
      providerRef: "TXN-PS-foreign-ref",
      status: PaymentStatus.PENDING,
      amountCents: 5000,
      currency: "NGN",
      order: { buyerId: "another-buyer", sellerId: "seller-paystack" },
    };
    const prisma = {
      paymentTransaction: {
        findFirst: jest.fn().mockResolvedValue(payment),
        updateMany: jest.fn(),
      },
      order: {
        update: jest.fn(),
      },
    };
    const paystackService = {
      verifyTransaction: jest.fn(),
    };
    const service = new OrdersService(
      prisma as never,
      {} as never,
      paystackService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.verifyPaystackPayment(payment.providerRef, "requesting-buyer"),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.paymentTransaction.findFirst).toHaveBeenCalledWith({
      where: {
        providerRef: payment.providerRef,
        provider: PaymentProvider.PAYSTACK,
      },
      include: { order: { select: { buyerId: true, sellerId: true } } },
    });
    expect(paystackService.verifyTransaction).not.toHaveBeenCalled();
    expect(prisma.paymentTransaction.updateMany).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
