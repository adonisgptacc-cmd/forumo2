import { createHmac } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
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
  get = jest.fn();
}

describe("ShippoWebhookController", () => {
  let app: INestApplication;
  let controller: ShippoWebhookController;
  let prisma: MockPrismaService;
  let notifications: MockNotificationsService;
  let config: MockConfigService;

  beforeEach(async () => {
    prisma = new MockPrismaService();
    notifications = new MockNotificationsService();
    config = new MockConfigService();
    config.get.mockReturnValue(SHIPPO_TEST_SECRET);

    const module = await Test.createTestingModule({
      providers: [
        ShippoWebhookController,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationsService,
          useValue: notifications,
        },
        {
          provide: ConfigService,
          useValue: config,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    controller = app.get(ShippoWebhookController);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("verifySignature", () => {
    it("rejects missing signature", async () => {
      await expect(
        (controller as any).verifySignature({ body: {} } as any, undefined),
      ).rejects.toThrow("Missing Shippo webhook signature");
    });

    it("rejects invalid signature", async () => {
      const rawBody = makeRawBody({ event: "test" });
      await expect(
        (controller as any).verifySignature(
          { body: {}, rawBody } as any,
          "invalid_signature",
        ),
      ).rejects.toThrow("Invalid Shippo webhook signature");
    });

    it("accepts valid signature", async () => {
      const rawBody = makeRawBody({ event: "test" });
      const signature = shippoSignatureHeader(rawBody);
      await expect(
        (controller as any).verifySignature(
          { body: {}, rawBody } as any,
          signature,
        ),
      ).resolves.not.toThrow();
    });

    it("rejects when SHIPPO_WEBHOOK_SECRET is not configured", async () => {
      config.get.mockReturnValue(undefined);
      const rawBody = makeRawBody({ event: "test" });
      await expect(
        (controller as any).verifySignature(
          { body: {}, rawBody } as any,
          "any_signature",
        ),
      ).rejects.toThrow("Shippo webhook secret not configured");
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
      const res = await request(app.getHttpServer())
        .post("/webhooks/shippo")
        .set(
          "x-shippo-signature",
          shippoSignatureHeader(JSON.stringify({ event: "other_event" })),
        )
        .send({ event: "other_event" });
      expect(res.body).toEqual({ received: true });
      expect(res.status).toBe(200);
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
      const res = await request(app.getHttpServer())
        .post("/webhooks/shippo")
        .set("x-shippo-signature", shippoSignatureHeader(makeRawBody(body)))
        .send(body);
      expect(res.body).toEqual({ received: true });
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
      const res = await request(app.getHttpServer())
        .post("/webhooks/shippo")
        .set("x-shippo-signature", shippoSignatureHeader(makeRawBody(body)))
        .send(body);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
      expect(prisma.orderShipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: shipmentId },
          data: expect.objectContaining({
            status: "DELIVERED",
          }),
        }),
      );
    });

    it("rejects webhook with invalid signature", async () => {
      const body = {
        event: "tracking_updated",
        data: {
          tracking_number: trackingNumber,
          carrier: "FedEx",
          tracking_status: { status: "IN_TRANSIT" },
        },
      };
      const res = await request(app.getHttpServer())
        .post("/webhooks/shippo")
        .set("x-shippo-signature", "invalid")
        .send(body);
      expect(res.status).toBe(401);
    });
  });
});
