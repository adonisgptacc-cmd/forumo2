import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service.js';
import { SafeUser, sanitizeUser } from '../users/user.serializer.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';

interface AuthResponse {
  user: SafeUser;
  accessToken: string;
}

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const existing = await this.findActiveUserByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: normalizedEmail,
        passwordHash,
        phone: dto.phone,
      },
    });

    await this.ensureUserProfile(user.id);

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.findActiveUserByEmail(this.normalizeEmail(dto.email));
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: string): Promise<AuthResponse> {
    const user = await this.usersService.findById(userId);
    return this.buildAuthResponse(user);
  }

  async requestOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const user = await this.findActiveUserByEmail(this.normalizeEmail(dto.email));
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }

    const code = this.generateOtpCode();
    const secret = this.generateOtpSecret();
    const codeHash = await bcrypt.hash(code, this.saltRounds);
    const expiresAt = this.getOtpExpirationDate();

    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        purpose: dto.purpose,
        secret,
        codeHash,
        expiresAt,
      },
    });

    await this.upsertDeviceSession(user.id, dto.deviceFingerprint, dto, { lastIssuedAt: new Date() });

    return { message: 'OTP issued' };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponse> {
    const user = await this.findActiveUserByEmail(this.normalizeEmail(dto.email));
    if (!user) {
      throw new UnauthorizedException('Invalid code');
    }

    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        purpose: dto.purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new UnauthorizedException('Invalid code');
    }

    const matches = await bcrypt.compare(dto.code, otpRecord.codeHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid code');
    }

    const consumedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { consumedAt },
      }),
      this.upsertDeviceSession(user.id, dto.deviceFingerprint, dto, { lastVerifiedAt: consumedAt }),
    ]);

    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: SafeUser | { passwordHash: string } & SafeUser): Promise<AuthResponse> {
    const safeUser = sanitizeUser(user)!;
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    const ttlValue = Number(this.configService.get<string>('JWT_TTL') ?? 86400);
    const expiresIn = Number.isNaN(ttlValue) ? 86400 : ttlValue;
    const token = await this.jwtService.signAsync(
      { sub: safeUser.id, role: safeUser.role },
      {
        secret,
        expiresIn,
      },
    );
    return { user: safeUser, accessToken: token };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async findActiveUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null } });
  }

  private async ensureUserProfile(userId: string): Promise<void> {
    await this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId, metadata: {} },
      update: {},
    });
  }

  private generateOtpSecret(): string {
    return randomBytes(16).toString('hex');
  }

  private generateOtpCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private getOtpExpirationDate(): Date {
    const ttlValue = Number(this.configService.get<string>('OTP_TTL') ?? 300);
    const ttl = Number.isNaN(ttlValue) ? 300 : ttlValue;
    return new Date(Date.now() + ttl * 1000);
  }

  private upsertDeviceSession(
    userId: string,
    fingerprint: string,
    payload: Pick<RequestOtpDto, 'deviceFingerprint' | 'ipAddress' | 'metadata' | 'userAgent'>,
    timestamps: Partial<{ lastIssuedAt: Date; lastVerifiedAt: Date }>,
  ) {
    const metadata = this.buildMetadata(payload.metadata);
    const base = {
      userAgent: payload.userAgent,
      ipAddress: payload.ipAddress,
      ...(metadata ? { metadata } : {}),
    };

    return this.prisma.deviceSession.upsert({
      where: { userId_fingerprint: { userId, fingerprint } },
      update: { ...base, ...timestamps },
      create: { userId, fingerprint, ...base, ...timestamps },
    });
  }

  private buildMetadata(metadata?: Record<string, unknown>): Prisma.JsonObject | undefined {
    if (!metadata || Object.keys(metadata).length === 0) {
      return undefined;
    }
    return metadata as Prisma.JsonObject;
  }
}
