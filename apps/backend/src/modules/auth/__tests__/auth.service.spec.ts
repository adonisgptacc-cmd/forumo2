import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NotificationChannel, OtpPurpose, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from "../../../prisma/prisma.service";
import { AuthService } from "../auth.service";
import { RequestOtpDto } from "../dto/request-otp.dto";
import { VerifyOtpDto } from "../dto/verify-otp.dto";
import { UsersService } from "../../users/users.service";
import { OtpDeliveryService } from "../otp-delivery.service";
import { RateLimitService } from "../../../common/services/rate-limit.service";

const createUser = (): User => ({
  id: 'user-1',
  name: 'Zuri',
  email: 'zuri@example.com',
  passwordHash: 'hashed',
  emailVerified: false,
  twoFactorEnabled: false,
  phone: '+27123456789',
  avatarUrl: null,
  role: 'BUYER',
  accountStatus: 'ACTIVE',
  trustScore: 0,
  kycStatus: 'PENDING',
  tokenVersion: 0,
  lastLoginAt: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  deletedAt: null,
});

type PrismaMock = {
  user: {
    findFirst: jest.Mock;
    create: jest.Mock;
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

describe('AuthService OTP flows', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let usersService: jest.Mocked<UsersService>;
  let otpDelivery: jest.Mocked<OtpDeliveryService>;
  let rateLimit: jest.Mocked<RateLimitService>;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
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
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
    } as unknown as jest.Mocked<JwtService>;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'OTP_TTL') {
          return '300';
        }
        if (key === 'JWT_TTL') {
          return '3600';
        }
        return undefined;
      }),
      getOrThrow: jest.fn().mockReturnValue('jwt-secret'),
    } as unknown as jest.Mocked<ConfigService>;

    usersService = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    otpDelivery = {
      deliver: jest.fn().mockResolvedValue({
        channel: NotificationChannel.EMAIL,
        provider: 'ses',
        referenceId: 'ref-123',
        deliveredAt: new Date('2024-01-01T00:00:00.000Z'),
        metadata: { region: 'us-east-1' },
      }),
    } as unknown as jest.Mocked<OtpDeliveryService>;

    rateLimit = {
      enforce: jest.fn(),
    } as unknown as jest.Mocked<RateLimitService>;

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService,
      configService,
      usersService,
      otpDelivery,
      rateLimit,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('issues OTP codes, enforces rate limits, and records delivery metadata', async () => {
    const user = createUser();
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpCode.create.mockImplementation(async (args) => args as never);
    prisma.deviceSession.upsert.mockResolvedValue({} as never);
    const dto: RequestOtpDto = {
      email: user.email,
      purpose: OtpPurpose.LOGIN,
      deviceFingerprint: 'fingerprint-123',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      metadata: { platform: 'web' },
    };

    jest.spyOn<any, string>(service as any, 'generateOtpCode').mockReturnValue('123456');

    await expect(service.requestOtp(dto)).resolves.toEqual({
      message: 'OTP issued',
      channel: NotificationChannel.EMAIL,
      deliveredAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    expect(prisma.otpCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          purpose: dto.purpose,
          secret: expect.any(String),
          channel: NotificationChannel.EMAIL,
          deliveryProvider: 'ses',
        }),
      }),
    );

    const callArgs = prisma.otpCode.create.mock.calls[0][0] as { data: { codeHash: string } };
    await expect(bcrypt.compare('123456', callArgs.data.codeHash)).resolves.toBe(true);

    expect(prisma.deviceSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_fingerprint: { userId: user.id, fingerprint: dto.deviceFingerprint } },
        update: expect.objectContaining({ lastIssuedAt: expect.any(Date) }),
      }),
    );

    expect(otpDelivery.deliver).toHaveBeenCalledWith(user, dto, '123456');
  });

  it('locks devices when rate limit exceeded', async () => {
    const user = createUser();
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpCode.count.mockResolvedValue(5);

    const dto: RequestOtpDto = {
      email: user.email,
      purpose: OtpPurpose.LOGIN,
      deviceFingerprint: 'fingerprint-123',
    } as RequestOtpDto;

    await expect(service.requestOtp(dto)).rejects.toThrow('Too many OTP requests for this device');
  });

  it('verifies OTP codes and returns auth response', async () => {
    const user = createUser();
    const codeHash = await bcrypt.hash('654321', 10);
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-1',
      userId: user.id,
      purpose: OtpPurpose.LOGIN,
      secret: 'secret',
      codeHash,
      channel: NotificationChannel.SMS,
      deviceFingerprint: 'fingerprint-123',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.otpCode.update.mockResolvedValue({} as never);
    prisma.deviceSession.upsert.mockResolvedValue({} as never);

    const dto: VerifyOtpDto = {
      email: user.email,
      purpose: OtpPurpose.LOGIN,
      code: '654321',
      deviceFingerprint: 'fingerprint-123',
      channel: NotificationChannel.SMS,
    };

    const response = await service.verifyOtp(dto);

    expect(response.user.id).toEqual(user.id);
    expect(response.accessToken).toEqual('signed.jwt.token');

    expect(prisma.otpCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'otp-1' },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );

    expect(prisma.deviceSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ lastVerifiedAt: expect.any(Date) }),
      }),
    );
  });

  it('prevents OTP replay after a code has been consumed', async () => {
    const user = createUser();
    const codeHash = await bcrypt.hash('222333', 10);
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpCode.findFirst
      .mockResolvedValueOnce({
        id: 'otp-2',
        userId: user.id,
        purpose: OtpPurpose.LOGIN,
        secret: 'secret',
        codeHash,
        channel: NotificationChannel.EMAIL,
        deviceFingerprint: 'fingerprint-xyz',
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
      email: user.email,
      purpose: OtpPurpose.LOGIN,
      code: '222333',
      deviceFingerprint: 'fingerprint-xyz',
      channel: NotificationChannel.EMAIL,
    };

    await expect(service.verifyOtp(dto)).resolves.toBeDefined();
    await expect(service.verifyOtp(dto)).rejects.toThrow('Invalid code');

    expect(prisma.otpCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'otp-2' },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );
  });

  it('enforces IP-based rate limits when device fingerprint is missing', async () => {
    const user = createUser();
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpCode.count.mockResolvedValue(5);

    const dto: RequestOtpDto = {
      email: user.email,
      purpose: OtpPurpose.LOGIN,
      deviceFingerprint: '',
      ipAddress: '127.0.0.1',
    } as RequestOtpDto;

    await expect(service.requestOtp(dto)).rejects.toThrow('Too many OTP requests for this device');

    expect(prisma.otpCode.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deviceFingerprint: 'ip:127.0.0.1' }),
      }),
    );
  });

  it('rejects OTP verification when device or channel do not match the issued code', async () => {
    const user = createUser();
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpCode.findFirst.mockResolvedValue(null);

    const dto: VerifyOtpDto = {
      email: user.email,
      purpose: OtpPurpose.LOGIN,
      code: '111111',
      deviceFingerprint: 'different-device',
      channel: NotificationChannel.EMAIL,
    };

    await expect(service.verifyOtp(dto)).rejects.toThrow('Invalid code');

    expect(prisma.otpCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deviceFingerprint: 'different-device', channel: NotificationChannel.EMAIL }),
      }),
    );
  });
});
