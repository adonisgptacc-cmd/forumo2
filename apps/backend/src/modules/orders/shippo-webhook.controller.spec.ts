import { createHmac } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ConfigService } from "@nestjs/config";
import { ShippoWebhookController } from "./shippo-webhook.controller";

const SHIPPO_TEST_SECRET = "shippo_test_webhook_secret_fake_abc123";

function shippoSignatureHeader(rawBody: string): string {
  const hmac = createHmac("sha256", SHIPPO_TEST_SECRET)
    .update(rawBody)
    .digest("hex");
  return hmac;
}

function makeRawBody(body: object): string {
  return JSON.stringify(body);
}

class MockPrismaService {
  orderShipment = {
    findFirst: jest.fn(),
    update: jest.fn(),
  };
  trackingEvent = {
    findFirst: jest.fn(),
    create: jest.fn(),
  };
  order = {
    update: jest.fn(),
  };
  escrowHolding = {
    update: jest.fn(),
  };
}

class MockNotificationsService {
  sendEmail = jest.fn().mockResolvedValue(undefined);
  createInApp = jest.fn().mockResolvedValue(undefined);
}

class MockConfigService {
  get = jest.fn((key: string) => {
    if (key === "SHIPPO_WEBHOOK_SECRET") return SHIPPO_TEST_SECRET;
    if (key === "ESCROW_AUTO_RELEASE_DAYS") return 5;
    return undefined;
  });
}

describe("ShippoWebhookController", () => {
  let controller: ShippoWebhookController;
  let prisma: MockPrismaService;
  let notifications: MockNotificationsService;
  let config: MockConfigService;

  beforeEach(() => {
    prisma = new MockPrismaService();
    notifications = new MockNotificationsService();
    config = new MockConfigService();

    controller = new ShippoWebhookController(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      config as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("verifySignature", () => {
    it("throws when signature is missing", () => {
      const req = { body: {} } as any;
      expect(() => (controller as any).verifySignature(req, undefined)).toThrow(
        "Missing Shippo webhook signature",
      );
    });

    it("throws when signature is invalid", () => {
      const rawBody = makeRawBody({ event: "test" });
      const req = { body: {}, rawBody } as any;
      expect(() =>
        (controller as any).verifySignature(req, "invalid_signature"),
      ).toThrow("Invalid Shippo webhook signature");
    });

    it("does not throw when signature is valid", () => {
      const rawBody = makeRawBody({ event: "test" });
      const signature = shippoSignatureHeader(rawBody);
      const req = { body: {}, rawBody } as any;
      expect(() =>
        (controller as any).verifySignature(req, signature),
      ).not.toThrow();
    });

    it("throws when SHIPPO_WEBHOOK_SECRET is not configured", () => {
      const mockGet = config.get as jest.Mock;
      mockGet.mockImplementation((key: string) => {
        if (key === "SHIPPO_WEBHOOK_SECRET") return undefined;
        if (key === "ESCROW_AUTO_RELEASE_DAYS") return 5;
        return undefined;
      });
      const rawBody = makeRawBody({ event: "test" });
      const req = { body: {}, rawBody } as any;
      expect(() =>
        (controller as any).verifySignature(req, "any_signature"),
      ).toThrow("Shippo webhook secret not configured");
    });
  });

  describe("handleShippoWebhook", () => {
    const trackingNumber = "shippo-tracking-123";
    const shipmentId = "shipment-1";
    const orderId = "order-1";

    beforeEach(() => {
      prisma.orderShipment.findFirst.mockResolvedValue({
        id: shipmentId,
        orderId,
        order: {
          id: orderId,
          status: "PENDING",
          escrow: { id: "escrow-1", status: "HOLDING", releaseAfter: null },
          buyer: { id: "buyer-1", email: "buyer@test.com", name: "Buyer" },
        },
      });
      prisma.trackingEvent.findFirst.mockResolvedValue(null);
    });

    it("returns received:true for non-tracking events", async () => {
      const body = { event: "other_event" };
      const signature = shippoSignatureHeader(makeRawBody(body));
      const result = await (controller as any).handleShippoWebhook(
        { body: {}, rawBody: makeRawBody(body) } as any,
        body,
        signature,
      );
      expect(result).toEqual({ received: true });
    });

    it("returns received:true when no shipment found", async () => {
      prisma.orderShipment.findFirst.mockResolvedValue(null);
      const body = {
        event: "tracking_updated",
        data: {
          tracking_number: trackingNumber,
          carrier: "FedEx",
          tracking_status: { status: "DELIVERED" },
        },
      };
      const signature = shippoSignatureHeader(makeRawBody(body));
      const result = await (controller as any).handleShippoWebhook(
        { body: {}, rawBody: makeRawBody(body) } as any,
        body,
        signature,
      );
      expect(result).toEqual({ received: true });
    });

    it("updates shipment status on tracking update", async () => {
      const body = {
        event: "tracking_updated",
        data: {
          tracking_number: trackingNumber,
          carrier: "FedEx",
          tracking_status: { status: "DELIVERED" },
          eta: new Date().toISOString(),
        },
      };
      const signature = shippoSignatureHeader(makeRawBody(body));
      const result = await (controller as any).handleShippoWebhook(
        { body: {}, rawBody: makeRawBody(body) } as any,
        body,
        signature,
      );
      expect(result).toEqual({ received: true });
      expect(prisma.orderShipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: shipmentId },
          data: expect.objectContaining({
            status: "DELIVERED",
          }),
        }),
      );
    });

    it("returns received:true when shipment not found", async () => {
      prisma.orderShipment.findFirst.mockResolvedValue(null);
      const body = {
        event: "tracking_updated",
        data: {
          tracking_number: "not-found",
          carrier: "FedEx",
          tracking_status: { status: "IN_TRANSIT" },
        },
      };
      const signature = shippoSignatureHeader(makeRawBody(body));
      const result = await (controller as any).handleShippoWebhook(
        { body: {}, rawBody: makeRawBody(body) } as any,
        body,
        signature,
      );
      expect(result).toEqual({ received: true });
    });
  });
});
