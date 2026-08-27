import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { NotificationChannel, OtpPurpose, User } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { authenticator } from "otplib";

import { PrismaService } from "../../../prisma/prisma.service";
import { AuthService } from "../auth.service";
import { RequestOtpDto } from "../dto/request-otp.dto";
import { VerifyOtpDto } from "../dto/verify-otp.dto";
import { UsersService } from "../../users/users.service";
import { OtpDeliveryService } from "../otp-delivery.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { CacheService } from "../../../common/services/cache.service";

const createUser = (): User => ({
  id: "user-1",
  name: "Zuri",
  email: "zuri@example.com",
  passwordHash: "hashed",
  phone: "+27123456789",
  phoneVerified: false,
  avatarUrl: null,
  role: "BUYER",
  trustScore: 0,
  kycStatus: "PENDING",
  tokenVersion: 0,
  lastLoginAt: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-02T00:00:00.000Z"),
  deletedAt: null,
  accountStatus: "ACTIVE",
  suspensionReason: null,
  suspendedUntil: null,
  banReason: null,
  termsAcceptedAt: null,
  privacyAcceptedAt: null,
  tosVersion: null,
  deletionScheduledAt: null,
  emailVerified: true,
  emailVerificationToken: null,
  twoFactorEnabled: false,
  twoFactorSecret: null,
  twoFactorBackupCodes: [],
  stripeConnectAccountId: null,
  stripeConnectOnboarded: false,
  paystackRecipientCode: null,
});

type PrismaMock = {
  user: {
    findFirst: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  otpCode: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  deviceSession: {
    upsert: jest.Mock;
  };
  userProfile: {
    upsert: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe("AuthService OTP flows", () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let usersService: jest.Mocked<UsersService>;
  let otpDelivery: jest.Mocked<OtpDeliveryService>;
  let cache: jest.Mocked<CacheService>;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      otpCode: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      deviceSession: {
        upsert: jest.fn(),
      },
      userProfile: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue("signed.jwt.token"),
    } as unknown as jest.Mocked<JwtService>;

    configService = {
      get: jest.fn((key: string) => {
        if (key === "OTP_TTL") {
          return "300";
        }
        if (key === "JWT_TTL") {
          return "3600";
        }
        return undefined;
      }),
      getOrThrow: jest.fn().mockReturnValue("jwt-secret"),
    } as unknown as jest.Mocked<ConfigService>;

    usersService = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    otpDelivery = {
      deliver: jest.fn().mockResolvedValue({
        channel: NotificationChannel.EMAIL,
        provider: "ses",
        referenceId: "ref-123",
        deliveredAt: new Date("2024-01-01T00:00:00.000Z"),
        metadata: { region: "us-east-1" },
      }),
    } as unknown as jest.Mocked<OtpDeliveryService>;

    const notifications = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationsService>;

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService,
      configService,
      usersService,
      otpDelivery,
      notifications,
      cache,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("issues OTP codes, enforces rate limits, and records delivery metadata", async () => {
    const user = createUser();
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpCode.create.mockImplementation(async (args) => args as never);
    prisma.deviceSession.upsert.mockResolvedValue({} as never);
    const dto: RequestOtpDto = {
      identifier: user.email!,
      purpose: OtpPurpose.LOGIN,
      deviceFingerprint: "fingerprint-123",
      ipAddress: "127.0.0.1",
      userAgent: "jest",
      metadata: { platform: "web" },
    };

    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      .spyOn<any, string>(service as any, "generateOtpCode")
      .mockReturnValue("123456");

    await expect(service.requestOtp(dto)).resolves.toEqual({
      message: "OTP issued",
      channel: NotificationChannel.EMAIL,
      deliveredAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    expect(prisma.otpCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          purpose: dto.purpose,
          secret: expect.any(String),
          channel: NotificationChannel.EMAIL,
          deliveryProvider: "ses",
        }),
      }),
    );

    const callArgs = prisma.otpCode.create.mock.calls[0][0] as {
      data: { codeHash: string };
    };
    await expect(
      bcrypt.compare("123456", callArgs.data.codeHash),
    ).resolves.toBe(true);

    expect(prisma.deviceSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_fingerprint: {
            userId: user.id,
            fingerprint: dto.deviceFingerprint,
          },
        },
        update: expect.objectContaining({ lastIssuedAt: expect.any(Date) }),
      }),
    );

    expect(otpDelivery.deliver).toHaveBeenCalledWith(user, dto, "123456");
  });

  it("locks devices when rate limit exceeded", async () => {
    const user = createUser();
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpCode.count.mockResolvedValue(5);

    const dto: RequestOtpDto = {
      identifier: user.email,
      purpose: OtpPurpose.LOGIN,
      deviceFingerprint: "fingerprint-123",
    } as RequestOtpDto;

    await expect(service.requestOtp(dto)).rejects.toThrow(
      "Too many OTP requests for this device",
    );
  });

  it("verifies OTP codes but routes into the 2FA gate instead of minting a session", async () => {
    // Consuming an OTP only proves the caller controls the identifier — it
    // must never mint a session directly, or a user could skip 2FA
    // enrollment entirely (see the PHONE_VERIFICATION variant of this bug
    // covered by auth.flows.spec.ts).
    const user = createUser();
    const codeHash = await bcrypt.hash("654321", 10);
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpCode.findFirst.mockResolvedValue({
      id: "otp-1",
      userId: user.id,
      purpose: OtpPurpose.LOGIN,
      secret: "secret",
      codeHash,
      channel: NotificationChannel.SMS,
      deviceFingerprint: "fingerprint-123",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.otpCode.update.mockResolvedValue({} as never);
    prisma.deviceSession.upsert.mockResolvedValue({} as never);

    const dto: VerifyOtpDto = {
      identifier: user.email!,
      purpose: OtpPurpose.LOGIN,
      code: "654321",
      deviceFingerprint: "fingerprint-123",
      channel: NotificationChannel.SMS,
    };

    const response = await service.verifyOtp(dto);

    expect(response).toEqual({
      twoFactorSetupRequired: true,
      twoFactorToken: "signed.jwt.token",
    });
    expect("accessToken" in response).toBe(false);

    expect(prisma.otpCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "otp-1" },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );

    expect(prisma.deviceSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ lastVerifiedAt: expect.any(Date) }),
      }),
    );
  });

  it("prevents OTP replay after a code has been consumed", async () => {
    const user = createUser();
    const codeHash = await bcrypt.hash("222333", 10);
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpCode.findFirst
      .mockResolvedValueOnce({
        id: "otp-2",
        userId: user.id,
        purpose: OtpPurpose.LOGIN,
        secret: "secret",
        codeHash,
        channel: NotificationChannel.EMAIL,
        deviceFingerprint: "fingerprint-xyz",
        expiresAt: new Date(Date.now() + 60_000),
        consumedAt: null,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce(null);
    prisma.otpCode.update.mockResolvedValue({} as never);
    prisma.deviceSession.upsert.mockResolvedValue({} as never);

    const dto: VerifyOtpDto = {
      identifier: user.email!,
      purpose: OtpPurpose.LOGIN,
      code: "222333",
      deviceFingerprint: "fingerprint-xyz",
      channel: NotificationChannel.EMAIL,
    };

    await expect(service.verifyOtp(dto)).resolves.toBeDefined();
    await expect(service.verifyOtp(dto)).rejects.toThrow("Invalid code");

    expect(prisma.otpCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "otp-2" },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );
  });

  it("enforces IP-based rate limits when device fingerprint is missing", async () => {
    const user = createUser();
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpCode.count.mockResolvedValue(5);

    const dto: RequestOtpDto = {
      identifier: user.email,
      purpose: OtpPurpose.LOGIN,
      deviceFingerprint: "",
      ipAddress: "127.0.0.1",
    } as RequestOtpDto;

    await expect(service.requestOtp(dto)).rejects.toThrow(
      "Too many OTP requests for this device",
    );

    expect(prisma.otpCode.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deviceFingerprint: "ip:127.0.0.1" }),
      }),
    );
  });

  it("rejects OTP verification when device or channel do not match the issued code", async () => {
    const user = createUser();
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpCode.findFirst.mockResolvedValue(null);

    const dto: VerifyOtpDto = {
      identifier: user.email!,
      purpose: OtpPurpose.LOGIN,
      code: "111111",
      deviceFingerprint: "different-device",
      channel: NotificationChannel.EMAIL,
    };

    await expect(service.verifyOtp(dto)).rejects.toThrow("Invalid code");

    expect(prisma.otpCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deviceFingerprint: "different-device",
          channel: NotificationChannel.EMAIL,
        }),
      }),
    );
  });

  describe("phone-primary register/login", () => {
    it("registers a phone-only user without requiring an email", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        ...createUser(),
        id: "user-2",
        email: null,
        phone: "+27821234567",
        emailVerified: false,
        phoneVerified: false,
      });

      const result = await service.register({
        name: "Thabo",
        password: "hunter2!Aa",
        phone: "+27821234567",
      } as never);

      expect(result.message).toMatch(/phone/i);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: "+27821234567" }),
        }),
      );
    });

    it("logs in by phone when the identifier is not email-shaped", async () => {
      const user = { ...createUser(), phone: "+27821234567" };
      prisma.user.findFirst.mockResolvedValue(user);

      // `user.passwordHash` ("hashed") is not a real bcrypt hash, so
      // bcrypt.compare resolves false and login() rejects with
      // "Invalid credentials" — that's expected here. This test only
      // verifies that login() classified the identifier as a phone number
      // and looked the user up by `phone`, not that login succeeds.
      await expect(
        service.login({
          identifier: "+27821234567",
          password: "irrelevant",
        } as never),
      ).rejects.toThrow("Invalid credentials");

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ phone: "+27821234567" }),
        }),
      );
    });
  });

  describe("phone verification", () => {
    it("blocks login for an unverified phone-only account", async () => {
      // createUser()'s default passwordHash ("hashed") is not a real bcrypt
      // hash of the password this test logs in with, so bcrypt.compare would
      // resolve false and login() would reject with "Invalid credentials"
      // before ever reaching the phoneVerified gate this test exercises.
      // Override with a real hash of the password used below so the gate
      // under test is actually the thing that rejects.
      const passwordHash = await bcrypt.hash("hunter2!Aa", 10);
      prisma.user.findFirst.mockResolvedValue({
        ...createUser(),
        email: null,
        phone: "+27821234567",
        phoneVerified: false,
        passwordHash,
      });

      await expect(
        service.login({
          identifier: "+27821234567",
          password: "hunter2!Aa",
        } as never),
      ).rejects.toThrow(/verify your phone/i);
    });

    it("issues a PHONE_VERIFICATION otp on phone-only registration", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const created = {
        ...createUser(),
        id: "user-3",
        email: null,
        phone: "+27821234567",
        phoneVerified: false,
      };
      prisma.user.create.mockResolvedValue(created);

      await service.register({
        name: "Thabo",
        password: "hunter2!Aa",
        phone: "+27821234567",
      } as never);

      expect(prisma.otpCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-3",
            purpose: "PHONE_VERIFICATION",
          }),
        }),
      );
    });

    it("marks phoneVerified on successful PHONE_VERIFICATION otp consumption but does not grant a session", async () => {
      // Regression test: verifyOtp() used to call buildAuthResponse() for
      // ANY OtpPurpose (including PHONE_VERIFICATION) with no 2FA check,
      // so a phone-only user could obtain a working session having never
      // enrolled in TOTP. It must return the same pending-2FA shape
      // login() does instead.
      const user = {
        ...createUser(),
        email: null,
        phone: "+27821234567",
        phoneVerified: false,
        twoFactorEnabled: false,
      };
      prisma.user.findFirst.mockResolvedValue(user);
      prisma.otpCode.findFirst.mockResolvedValue({
        id: "otp-1",
        codeHash: await bcrypt.hash("654321", 10),
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const response = await service.verifyOtp({
        identifier: "+27821234567",
        purpose: "PHONE_VERIFICATION",
        code: "654321",
        deviceFingerprint: "fp-1",
      } as never);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: expect.objectContaining({ phoneVerified: true }),
        }),
      );

      expect(response).toEqual({
        twoFactorSetupRequired: true,
        twoFactorToken: "signed.jwt.token",
      });
      expect("accessToken" in response).toBe(false);
    });
  });

  describe("TOTP lockout via Redis", () => {
    it("locks out after 5 failed attempts using the cache, not an in-process counter", async () => {
      cache.get.mockResolvedValue(undefined);
      prisma.user.findFirst.mockResolvedValue(createUser());

      // NOTE: the task brief's version of this test queued 5 mocked
      // cache.get() values but only called recordTotpFailure() once, so the
      // 5th-failure lockout branch (entry.count >= TOTP_MAX_ATTEMPTS) never
      // actually ran and the `lockedUntil: expect.any(Number)` assertion
      // below would fail against a correct implementation (lockedUntil
      // stays null until the 5th failure). Calling recordTotpFailure() once
      // per queued value — as the test's own title and setup ("after 5
      // failed attempts") imply — makes the 5th call the one that trips the
      // lock, matching the assertion.
      for (let i = 0; i < 5; i++) {
        cache.get.mockResolvedValueOnce({ count: i, lockedUntil: null });
        // eslint-disable-next-line no-await-in-loop -- sequential attempts must observe each other's cache writes
        await (
          service as unknown as {
            recordTotpFailure: (userId: string) => Promise<void>;
          }
        ).recordTotpFailure("user-1");
      }

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining("user-1"),
        expect.objectContaining({ lockedUntil: expect.any(Number) }),
        expect.any(Number),
      );
    });

    it("rejects a 2FA attempt when the cache reports an active lock", async () => {
      cache.get.mockResolvedValue({
        count: 0,
        lockedUntil: Date.now() + 60_000,
      });

      await expect(
        (
          service as unknown as {
            checkTotpAttempts: (userId: string) => Promise<void>;
          }
        ).checkTotpAttempts("user-1"),
      ).rejects.toThrow(/too many failed attempts/i);
    });
  });

  describe("initSetup2FA QR label for phone-only users", () => {
    it("uses phone as the TOTP QR label when email is null", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        ...createUser(),
        email: null,
        phone: "+27821234567",
        twoFactorEnabled: false,
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.initSetup2FA("user-1");

      expect(result.qrCode).toBeDefined();
      // The QR code encodes the label via otplib's keyuri — decoding the
      // data URL isn't necessary here; this test's real job is proving
      // initSetup2FA() doesn't throw/crash on a null email, which it would
      // if `authenticator.keyuri(user.email, ...)` were called with `null`.
    });
  });

  describe("2FA completion for phone-only users", () => {
    it("completeTwoFactorLogin() succeeds for a phone-only user (no redundant email re-lookup)", async () => {
      const phoneOnlyUser = {
        ...createUser(),
        email: null,
        phone: "+27821234567",
        twoFactorEnabled: true,
        twoFactorSecret: "JBSWY3DPEHPK3PXP",
      };
      cache.get.mockResolvedValue(undefined);
      prisma.user.findUniqueOrThrow.mockResolvedValue(phoneOnlyUser);
      prisma.user.update.mockResolvedValue(phoneOnlyUser);
      jest.spyOn(authenticator, "verify").mockReturnValue(true);

      // Before this task's fix, this call would either fail to compile
      // (findActiveUserByEmail expects a string, user.email is null) or, if
      // "fixed" with a bare non-null assertion instead of removing the
      // redundant re-fetch, throw at runtime for exactly this user.
      await expect(
        service.completeTwoFactorLogin(phoneOnlyUser.id, "123456"),
      ).resolves.toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
        }),
      );
    });
  });

  describe("OAuth account recovery", () => {
    it("returns passwordSetupRequired instead of the normal 2FA gate for passwordHash === ''", async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...createUser(),
        passwordHash: "",
      });

      const result = await service.login({
        identifier: "zuri@example.com",
        password: "anything",
      } as never);

      expect(result).toEqual(
        expect.objectContaining({ passwordSetupRequired: true }),
      );
    });
  });
});
