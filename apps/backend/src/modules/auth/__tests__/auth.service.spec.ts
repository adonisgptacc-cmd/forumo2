import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../../prisma/prisma.service.js';
import { AuthService } from '../auth.service.js';
import { RequestOtpDto } from '../dto/request-otp.dto.js';
import { VerifyOtpDto } from '../dto/verify-otp.dto.js';
import { UsersService } from '../../users/users.service.js';

const createUser = (): User => ({
  id: 'user-1',
  name: 'Zuri',
  email: 'zuri@example.com',
  passwordHash: 'hashed',
  phone: '+27123456789',
  avatarUrl: null,
  role: 'BUYER',
  trustScore: 0,
  kycStatus: 'PENDING',
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

    service = new AuthService(prisma as unknown as PrismaService, jwtService, configService, usersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('issues OTP codes and tracks device sessions', async () => {
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

    await expect(service.requestOtp(dto)).resolves.toEqual({ message: 'OTP issued' });

    expect(prisma.otpCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          purpose: dto.purpose,
          secret: expect.any(String),
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
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
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
});
