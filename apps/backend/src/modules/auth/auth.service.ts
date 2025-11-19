import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NotificationChannel, OtpPurpose, Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';

import type {
  AuthResponse,
  LoginDto as LoginInput,
  PasswordResetConfirmDto as PasswordResetConfirmInput,
  RegisterDto as RegisterInput,
  RequestOtpDto as RequestOtpInput,
  RequestPasswordResetDto as RequestPasswordResetInput,
  SafeUser,
  VerifyOtpDto as VerifyOtpInput,
} from '@forumo/shared';
import { sanitizeUser } from '@forumo/shared';

import { PrismaService } from '../../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { OtpDeliveryService } from './otp-delivery.service.js';

interface OtpIssueResponse {
  message: string;
  channel: NotificationChannel;
  deliveredAt: Date;
}

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly otpDeliveryService: OtpDeliveryService,
  ) {}

  async register(dto: RegisterInput): Promise<AuthResponse> {
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

  async login(dto: LoginInput): Promise<AuthResponse> {
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

  async requestOtp(dto: RequestOtpInput): Promise<OtpIssueResponse> {
    const user = await this.findActiveUserByEmail(this.normalizeEmail(dto.email));
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }

    await this.enforceDeviceRateLimit(user.id, dto.deviceFingerprint);

    const code = this.generateOtpCode();
    const secret = this.generateOtpSecret();
    const codeHash = await bcrypt.hash(code, this.saltRounds);
    const expiresAt = this.getOtpExpirationDate();
    const delivery = await this.otpDeliveryService.deliver(user, dto, code);

    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        purpose: dto.purpose,
        secret,
        codeHash,
        expiresAt,
        channel: delivery.channel,
        deviceFingerprint: dto.deviceFingerprint,
        deliveryProvider: delivery.provider,
        deliveryReference: delivery.referenceId,
        deliveryMetadata: this.buildMetadata(delivery.metadata),
        deliveredAt: delivery.deliveredAt,
      },
    });

    await this.upsertDeviceSession(user.id, dto.deviceFingerprint, dto, { lastIssuedAt: new Date() });

    return { message: 'OTP issued', channel: delivery.channel, deliveredAt: delivery.deliveredAt };
  }

  async verifyOtp(dto: VerifyOtpInput): Promise<AuthResponse> {
    const user = await this.findActiveUserByEmail(this.normalizeEmail(dto.email));
    if (!user) {
      throw new UnauthorizedException('Invalid code');
    }

    const consumedAt = await this.consumeOtp(user, dto);

    await this.upsertDeviceSession(user.id, dto.deviceFingerprint, dto, { lastVerifiedAt: consumedAt });

    return this.buildAuthResponse(user);
  }

  async requestPasswordReset(dto: RequestPasswordResetInput): Promise<OtpIssueResponse> {
    const payload: RequestOtpInput = {
      ...dto,
      purpose: OtpPurpose.PASSWORD_RESET,
    } satisfies RequestOtpInput;

    return this.requestOtp(payload);
  }

  async confirmPasswordReset(dto: PasswordResetConfirmInput): Promise<{ message: string }> {
    const user = await this.findActiveUserByEmail(this.normalizeEmail(dto.email));
    if (!user) {
      throw new UnauthorizedException('Invalid code');
    }

    const consumedAt = await this.consumeOtp(
      user,
      {
        email: dto.email,
        code: dto.code,
        deviceFingerprint: dto.deviceFingerprint,
        ipAddress: dto.ipAddress,
        metadata: dto.metadata,
        purpose: OtpPurpose.PASSWORD_RESET,
        userAgent: dto.userAgent,
      },
    );

    const passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.upsertDeviceSession(user.id, dto.deviceFingerprint, dto, { lastVerifiedAt: consumedAt }),
    ]);

    return { message: 'Password reset successful' };
  }

  async listDeviceSessions(userId: string) {
    await this.ensureExists(userId);
    return this.prisma.deviceSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
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
    payload: Pick<RequestOtpInput, 'deviceFingerprint' | 'ipAddress' | 'metadata' | 'userAgent'>,
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

  private async consumeOtp(user: User, dto: VerifyOtpInput): Promise<Date> {
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
    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { consumedAt },
    });

    return consumedAt;
  }

  private async enforceDeviceRateLimit(userId: string, fingerprint: string): Promise<void> {
    const limitValue = Number(this.configService.get<string>('OTP_DEVICE_RATE_LIMIT') ?? 5);
    const windowSecondsValue = Number(this.configService.get<string>('OTP_DEVICE_RATE_WINDOW') ?? 300);
    const limit = Number.isNaN(limitValue) ? 5 : limitValue;
    const windowSeconds = Number.isNaN(windowSecondsValue) ? 300 : windowSecondsValue;

    if (!fingerprint) {
      return;
    }

    const windowStart = new Date(Date.now() - windowSeconds * 1000);
    const recentCount = await this.prisma.otpCode.count({
      where: {
        userId,
        deviceFingerprint: fingerprint,
        createdAt: { gte: windowStart },
      },
    });

    if (recentCount >= limit) {
      throw new HttpException('Too many OTP requests for this device', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!exists) {
      throw new UnauthorizedException('Account not found');
    }
  }
}
