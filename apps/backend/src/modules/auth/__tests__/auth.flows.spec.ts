import type { INestApplication } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import {
  NotificationChannel,
  OtpPurpose,
  Prisma,
  UserRole,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import request from "supertest";

import { PrismaService } from "../../../prisma/prisma.service";
import { AuthModule } from "../auth.module";
import { AuthService } from "../auth.service";
import { OtpDeliveryService } from "../otp-delivery.service";
import { RequestOtpDto } from "../dto/request-otp.dto";

class FakeConfigService {
  private readonly values: Record<string, string> = {
    JWT_SECRET: "test-secret",
    JWT_TTL: "3600",
    OTP_TTL: "300",
    OTP_DEVICE_RATE_LIMIT: "5",
    OTP_DEVICE_RATE_WINDOW: "300",
    GOOGLE_CLIENT_ID: "test-google-id",
    GOOGLE_CLIENT_SECRET: "test-google-secret",
    GOOGLE_CALLBACK_URL: "http://localhost/callback",
  };

  get<T = string>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }

  getOrThrow<T = string>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined || value === null) {
      throw new Error(`Missing configuration for ${key}`);
    }
    return value;
  }
}

type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  phone: string | null;
  phoneVerified: boolean;
  avatarUrl: string | null;
  role: UserRole;
  trustScore: number;
  kycStatus: string;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type OtpRecord = {
  id: string;
  userId: string;
  purpose: OtpPurpose;
  secret: string;
  codeHash: string;
  channel: NotificationChannel;
  deviceFingerprint: string | null;
  deliveryProvider: string | null;
  deliveryReference: string | null;
  deliveryMetadata: Prisma.JsonValue | null;
  deliveredAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type DeviceSessionRecord = {
  id: string;
  userId: string;
  fingerprint: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  metadata?: Prisma.JsonValue | null;
  lastIssuedAt?: Date | null;
  lastVerifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

class InMemoryPrismaService {
  readonly users = new Map<string, UserRecord>();
  readonly otpCodes: OtpRecord[] = [];
  readonly deviceSessions = new Map<string, DeviceSessionRecord>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
  readonly profiles = new Map<string, any>();

  user = {
    findFirst: async ({ where }: { where: Partial<UserRecord> }) => {
      if (where?.email) {
        return (
          Array.from(this.users.values()).find(
            (user) => user.email === where.email && user.deletedAt === null,
          ) ?? null
        );
      }
      if (where?.id) {
        return this.users.get(where.id) ?? null;
      }
      return null;
    },
    create: async ({ data }: { data: Partial<UserRecord> }) => {
      const id = data.id ?? randomUUID();
      const now = new Date();
      const record: UserRecord = {
        id,
        name: data.name ?? "Test User",
        email: data.email!,
        passwordHash: data.passwordHash!,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        phone: (data as any).phone ?? null,
        phoneVerified: (data as any).phoneVerified ?? false,
        avatarUrl: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        role: (data as any).role ?? UserRole.BUYER,
        trustScore: 0,
        kycStatus: "PENDING",
        // Test users are pre-verified by default so login tests pass
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        emailVerified: (data as any).emailVerified ?? true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        emailVerificationToken: (data as any).emailVerificationToken ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      this.users.set(id, record);
      return record;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<UserRecord>;
    }) => {
      const record = this.users.get(where.id);
      if (!record) throw new Error("User not found");
      Object.assign(record, data, { updatedAt: new Date() });
      this.users.set(where.id, record);
      return record;
    },
  };

  otpCode = {
    create: async ({ data }: { data: Partial<OtpRecord> }) => {
      const record: OtpRecord = {
        id: randomUUID(),
        userId: data.userId!,
        purpose: data.purpose!,
        secret: data.secret!,
        codeHash: data.codeHash!,
        channel: data.channel!,
        deviceFingerprint: data.deviceFingerprint ?? null,
        deliveryProvider: data.deliveryProvider ?? null,
        deliveryReference: data.deliveryReference ?? null,
        deliveryMetadata: (data.deliveryMetadata as Prisma.JsonValue) ?? null,
        deliveredAt: (data.deliveredAt as Date) ?? new Date(),
        expiresAt: data.expiresAt!,
        consumedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.otpCodes.push(record);
      return record;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    findFirst: async ({ where }: { where: any }) => {
      const expiresAfter: Date | undefined = where?.expiresAt?.gt;
      const matches = this.otpCodes.filter((record) => {
        return (
          (!where.userId || record.userId === where.userId) &&
          (!where.purpose || record.purpose === where.purpose) &&
          (where.consumedAt === null ? record.consumedAt === null : true) &&
          (!expiresAfter || record.expiresAt > expiresAfter) &&
          (where.deviceFingerprint === undefined ||
            record.deviceFingerprint === where.deviceFingerprint) &&
          (where.channel === undefined || record.channel === where.channel)
        );
      });
      if (matches.length === 0) return null;
      return matches[matches.length - 1];
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<OtpRecord>;
    }) => {
      const index = this.otpCodes.findIndex((record) => record.id === where.id);
      if (index === -1) throw new Error("OTP not found");
      const updated = {
        ...this.otpCodes[index],
        ...data,
        updatedAt: new Date(),
      } as OtpRecord;
      this.otpCodes[index] = updated;
      return updated;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    count: async ({ where }: { where: any }) => {
      const fingerprint = where.deviceFingerprint;
      const windowStart = where.createdAt?.gte as Date;
      return this.otpCodes.filter((record) => {
        return (
          record.userId === where.userId &&
          record.deviceFingerprint === fingerprint &&
          (!windowStart || record.createdAt >= windowStart)
        );
      }).length;
    },
  };

  deviceSession = {
    upsert: async ({
      where,
      update,
      create,
    }: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      where: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      update: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: any;
    }) => {
      const key = `${where.userId_fingerprint.userId}:${where.userId_fingerprint.fingerprint}`;
      const existing = this.deviceSessions.get(key);
      const now = new Date();
      const base: DeviceSessionRecord = existing ?? {
        id: randomUUID(),
        userId: where.userId_fingerprint.userId,
        fingerprint: where.userId_fingerprint.fingerprint,
        createdAt: now,
        updatedAt: now,
      };
      const updated: DeviceSessionRecord = {
        ...base,
        ...(existing ? update : create),
        updatedAt: new Date(),
      };
      this.deviceSessions.set(key, updated);
      return updated;
    },
    findMany: async ({ where }: { where: { userId: string } }) => {
      return Array.from(this.deviceSessions.values()).filter(
        (record) => record.userId === where.userId,
      );
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    updateMany: async ({ where, data }: { where: any; data: any }) => {
      let count = 0;
      for (const [_key, session] of this.deviceSessions.entries()) {
        if (!where.userId || session.userId === where.userId) {
          Object.assign(session, data, { updatedAt: new Date() });
          count++;
        }
      }
      return { count };
    },
  };

  userProfile = {
    upsert: async ({
      where,
      create,
    }: {
      where: { userId: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      create: any;
    }) => {
      this.profiles.set(where.userId, { ...create, updatedAt: new Date() });
      return this.profiles.get(where.userId);
    },
  };

  auditLog = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
    create: async ({ data }: { data: any }) => {
      return { id: randomUUID(), ...data };
    },
  };

  $transaction = async (operations: Promise<unknown>[]) =>
    Promise.all(operations);
}

const createUser = async (
  prisma: InMemoryPrismaService,
  overrides: Partial<UserRecord> = {},
) => {
  const passwordHash =
    overrides.passwordHash ?? (await bcrypt.hash("password123", 10));
  return prisma.user.create({
    data: {
      id: overrides.id ?? "user-otp",
      name: "Otp User",
      email: "otp@example.com",
      passwordHash,
      phone: "+233550000000",
      ...overrides,
    },
  });
};

describe("AuthModule HTTP flows", () => {
  let app: INestApplication;
  let prisma: InMemoryPrismaService;
  let otpDelivery: jest.Mocked<OtpDeliveryService>;
  let authService: AuthService;

  beforeEach(async () => {
    // Set environment variables for OAuth strategy
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.GOOGLE_CLIENT_ID = "test-google-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";

    prisma = new InMemoryPrismaService();
    otpDelivery = {
      deliver: jest.fn(async (user, dto) => ({
        channel:
          dto.channel ??
          (user.phone ? NotificationChannel.SMS : NotificationChannel.EMAIL),
        provider: "mailgun",
        deliveredAt: new Date("2024-01-01T00:00:00.000Z"),
        referenceId: "ref-otp",
        metadata: { simulated: true, userId: user.id },
      })),
    } as unknown as jest.Mocked<OtpDeliveryService>;

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(OtpDeliveryService)
      .useValue(otpDelivery)
      .overrideProvider(ConfigService)
      .useValue(new FakeConfigService())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    authService = moduleRef.get(AuthService);
  });

  afterEach(async () => {
    if (app) {
      try {
        await app.close();
      } catch (err) {
        // Silently handle close errors in tests
        console.debug(
          "App close error (expected in tests):",
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  });

  it("prefers EMAIL when the user has both identifiers and channel is omitted", async () => {
    const user = await createUser(prisma, { phone: "+233550000001" });
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      .spyOn<any, string>(authService as any, "generateOtpCode")
      .mockReturnValue("999000");

    const response = await request(app.getHttpServer())
      .post("/auth/otp/request")
      .send({
        email: user.email,
        purpose: OtpPurpose.LOGIN,
        deviceFingerprint: "device-sms",
      })
      .expect(201);

    expect(response.body.channel).toBe(NotificationChannel.EMAIL);
    const [, deliveredDto] = otpDelivery.deliver.mock.calls[0];
    expect((deliveredDto as RequestOtpDto).channel).toBeUndefined();
    expect(prisma.otpCodes[0].channel).toBe(NotificationChannel.EMAIL);
  });

  it("issues and verifies OTP codes while recording device sessions", async () => {
    const user = await createUser(prisma);
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      .spyOn<any, string>(authService as any, "generateOtpCode")
      .mockReturnValue("135246");

    const issueResponse = await request(app.getHttpServer())
      .post("/auth/otp/request")
      .send({
        email: user.email,
        purpose: OtpPurpose.LOGIN,
        channel: NotificationChannel.EMAIL,
        deviceFingerprint: "device-1",
        userAgent: "jest",
      })
      .expect(201);

    expect(issueResponse.body).toEqual({
      message: "OTP issued",
      channel: NotificationChannel.EMAIL,
      deliveredAt: "2024-01-01T00:00:00.000Z",
    });
    expect(otpDelivery.deliver).toHaveBeenCalled();
    expect(prisma.otpCodes[0].deliveryProvider).toBe("mailgun");

    const verifyResponse = await request(app.getHttpServer())
      .post("/auth/otp/verify")
      .send({
        email: user.email,
        purpose: OtpPurpose.LOGIN,
        code: "135246",
        deviceFingerprint: "device-1",
        channel: NotificationChannel.EMAIL,
      })
      .expect(201);

    expect(verifyResponse.body.accessToken).toBeDefined();
    const [session] = await prisma.deviceSession.findMany({
      where: { userId: user.id },
    });
    expect(session.lastIssuedAt).toBeDefined();
    expect(session.lastVerifiedAt).toBeDefined();
  });

  it("resets passwords with OTP and enforces the new secret", async () => {
    const newPassword = ["new", "password", "123"].join("-");
    const user = await createUser(prisma);
    const originalHash = user.passwordHash;
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      .spyOn<any, string>(authService as any, "generateOtpCode")
      .mockReturnValue("777888");

    await request(app.getHttpServer())
      .post("/auth/password/reset/request")
      .send({
        email: user.email,
        channel: NotificationChannel.EMAIL,
        deviceFingerprint: "reset-device",
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/auth/password/reset/confirm")
      .send({
        email: user.email,
        code: "777888",
        newPassword,
        deviceFingerprint: "reset-device",
        channel: NotificationChannel.EMAIL,
      })
      .expect(201)
      .expect(({ body }) =>
        expect(body.message).toBe("Password reset successful"),
      );

    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: user.email, password: newPassword })
      .expect(201);

    expect(loginResponse.body).toEqual({
      twoFactorSetupRequired: true,
      twoFactorToken: expect.any(String),
    });
    expect(prisma.users.get(user.id)?.passwordHash).not.toEqual(originalHash);
  });

  it("lists device sessions for an authenticated user", async () => {
    const user = await createUser(prisma);
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      .spyOn<any, string>(authService as any, "generateOtpCode")
      .mockReturnValue("111222");

    await request(app.getHttpServer())
      .post("/auth/otp/request")
      .send({
        email: user.email,
        purpose: OtpPurpose.LOGIN,
        channel: NotificationChannel.EMAIL,
        deviceFingerprint: "fingerprint-abc",
      })
      .expect(201);

    const verifyResponse = await request(app.getHttpServer())
      .post("/auth/otp/verify")
      .send({
        email: user.email,
        purpose: OtpPurpose.LOGIN,
        code: "111222",
        deviceFingerprint: "fingerprint-abc",
        channel: NotificationChannel.EMAIL,
      })
      .expect(201);

    const token = verifyResponse.body.accessToken as string;
    const sessionsResponse = await request(app.getHttpServer())
      .get("/auth/sessions")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(sessionsResponse.body)).toBe(true);
    expect(sessionsResponse.body[0].fingerprint).toBe("fingerprint-abc");
  });
});
