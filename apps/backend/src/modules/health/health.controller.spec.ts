import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { PrismaService } from "../../prisma/prisma.service";
import { ModerationQueueService } from "../listings/moderation-queue.service";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue("PONG"),
    quit: jest.fn().mockResolvedValue(undefined),
  }));
});

const originalFetch = global.fetch;

function mockPrisma() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
  } as unknown as PrismaService;
}

function mockModerationQueue() {
  return {
    getMetrics: jest.fn().mockResolvedValue({ pending: 0, active: 0 }),
  } as unknown as ModerationQueueService;
}

function mockConfigService() {
  return {
    get: jest.fn((key: string) => process.env[key]),
  } as unknown as ConfigService;
}

describe("HealthController — integrations", () => {
  let app: INestApplication;

  beforeAll(() => {
    // Mock fetch for MinIO health check to avoid real network
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true } as unknown as Response);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    // Avoid real Redis/MinIO network calls in CI
    (
      jest.spyOn(
        HealthService.prototype as never,
        "checkRedis" as never,
      ) as unknown as jest.SpyInstance
    ).mockResolvedValue({
      status: "up",
      responseTime: 1,
    });
    (
      jest.spyOn(
        HealthService.prototype as never,
        "checkMinio" as never,
      ) as unknown as jest.SpyInstance
    ).mockResolvedValue({
      status: "up",
      responseTime: 1,
    });
    (
      jest.spyOn(
        HealthService.prototype as never,
        "checkDatabase" as never,
      ) as unknown as jest.SpyInstance
    ).mockResolvedValue({
      status: "up",
      responseTime: 1,
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma() },
        { provide: ModerationQueueService, useValue: mockModerationQueue() },
        { provide: ConfigService, useValue: mockConfigService() },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close().catch(() => {});
    jest.restoreAllMocks();
    // keep global.fetch mocked across tests; re-apply after restoreAllMocks
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true } as unknown as Response);
  });

  it("GET /api/v1/healthz reports integrations with expected keys", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/healthz")
      .expect(200);

    expect(res.body.status).toBeDefined();
    expect(res.body.integrations).toBeDefined();
    expect(res.body.integrations.stripe).toBeDefined();
    expect(typeof res.body.integrations.stripe.enabled).toBe("boolean");
    expect(res.body.integrations.paystack).toBeDefined();
    expect(typeof res.body.integrations.paystack.enabled).toBe("boolean");
    expect(res.body.integrations.shippo).toBeDefined();
    expect(typeof res.body.integrations.shippo.enabled).toBe("boolean");
    expect(res.body.integrations.mailgun).toBeDefined();
    expect(typeof res.body.integrations.mailgun.enabled).toBe("boolean");
    expect(res.body.integrations.sns).toBeDefined();
    expect(typeof res.body.integrations.sns.enabled).toBe("boolean");
    expect(res.body.integrations.oauth).toEqual({
      enabled: false,
      reason: "Google OAuth removed — magic link",
    });
    expect(res.body.integrations.mocks).toBeDefined();
    expect(typeof res.body.integrations.mocks.enabled).toBe("boolean");
  });

  it("GET /api/v1/health also reports integrations (legacy path)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200);
    expect(res.body.integrations).toBeDefined();
    expect(res.body.integrations.stripe.enabled).toBeDefined();
  });

  it("reports disabled integrations when env vars are absent", async () => {
    const origStripe = process.env.STRIPE_SECRET_KEY;
    const origPaystack = process.env.PAYSTACK_SECRET_KEY;
    const origPaystackAlt = process.env.PAYSTACK_SECRET;
    const origShippo = process.env.SHIPPO_API_KEY;
    const origMailgun = process.env.MAILGUN_API_KEY;
    const origSns = process.env.SNS_ACCESS_KEY_ID;
    const origMocks = process.env.NEXT_PUBLIC_USE_API_MOCKS;

    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.PAYSTACK_SECRET;
    delete process.env.SHIPPO_API_KEY;
    delete process.env.MAILGUN_API_KEY;
    delete process.env.SNS_ACCESS_KEY_ID;
    delete process.env.NEXT_PUBLIC_USE_API_MOCKS;

    const res = await request(app.getHttpServer())
      .get("/api/v1/healthz")
      .expect(200);

    expect(res.body.integrations.stripe.enabled).toBe(false);
    expect(res.body.integrations.paystack.enabled).toBe(false);
    expect(res.body.integrations.shippo.enabled).toBe(false);
    expect(res.body.integrations.mailgun.enabled).toBe(false);
    expect(res.body.integrations.sns.enabled).toBe(false);
    expect(res.body.integrations.oauth.enabled).toBe(false);
    expect(res.body.integrations.mocks.enabled).toBe(false);

    if (origStripe !== undefined) process.env.STRIPE_SECRET_KEY = origStripe;
    if (origPaystack !== undefined)
      process.env.PAYSTACK_SECRET_KEY = origPaystack;
    if (origPaystackAlt !== undefined)
      process.env.PAYSTACK_SECRET = origPaystackAlt;
    if (origShippo !== undefined) process.env.SHIPPO_API_KEY = origShippo;
    if (origMailgun !== undefined) process.env.MAILGUN_API_KEY = origMailgun;
    if (origSns !== undefined) process.env.SNS_ACCESS_KEY_ID = origSns;
    if (origMocks !== undefined)
      process.env.NEXT_PUBLIC_USE_API_MOCKS = origMocks;
  });

  it("reports enabled integrations when env vars are present", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.PAYSTACK_SECRET_KEY = "sk_test_paystack";
    process.env.SHIPPO_API_KEY = "shippo_test";
    process.env.MAILGUN_API_KEY = "mailgun_test";
    process.env.SNS_ACCESS_KEY_ID = "sns_test";
    process.env.NEXT_PUBLIC_USE_API_MOCKS = "true";

    const res = await request(app.getHttpServer())
      .get("/api/v1/healthz")
      .expect(200);

    expect(res.body.integrations.stripe.enabled).toBe(true);
    expect(res.body.integrations.paystack.enabled).toBe(true);
    expect(res.body.integrations.shippo.enabled).toBe(true);
    expect(res.body.integrations.mailgun.enabled).toBe(true);
    expect(res.body.integrations.sns.enabled).toBe(true);
    expect(res.body.integrations.mocks.enabled).toBe(true);

    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.SHIPPO_API_KEY;
    delete process.env.MAILGUN_API_KEY;
    delete process.env.SNS_ACCESS_KEY_ID;
    delete process.env.NEXT_PUBLIC_USE_API_MOCKS;
  });

  it("supports PAYSTACK_SECRET fallback", async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    process.env.PAYSTACK_SECRET = "fallback_secret";

    const res = await request(app.getHttpServer())
      .get("/api/v1/healthz")
      .expect(200);
    expect(res.body.integrations.paystack.enabled).toBe(true);

    delete process.env.PAYSTACK_SECRET;
  });
});
