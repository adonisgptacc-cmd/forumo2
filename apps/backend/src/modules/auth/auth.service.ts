import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DeviceSessionStatus, NotificationChannel, OtpPurpose, Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';

import type { AuthResponse } from '@forumo/shared';
import {
  LoginDto as LoginInput,
  PasswordResetConfirmDto as PasswordResetConfirmInput,
  RegisterDto as RegisterInput,
  RequestOtpDto as RequestOtpInput,
  RequestPasswordResetDto as RequestPasswordResetInput,
  VerifyOtpDto as VerifyOtpInput,
} from '../../common/dtos/auth.dto.js';
import { SafeUser, sanitizeUser } from '../users/user.serializer.js';

import { PrismaService } from '../../prisma/prisma.service.js';
import { RateLimitService } from '../../common/services/rate-limit.service.js';
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
    private readonly rateLimitService: RateLimitService,
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

    return this.buildAuthResponse(user, {});
  }

  async login(dto: LoginInput): Promise<AuthResponse> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user = await this.findActiveUserByEmail(normalizedEmail);
    if (!user) {
      this.enforceLoginAttemptLimit(normalizedEmail);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      this.enforceLoginAttemptLimit(normalizedEmail);
      throw new UnauthorizedException('Invalid credentials');
    }

    const response = await this.buildAuthResponse(user, {
      rememberMe: dto.rememberMe,
      sessionFingerprint: this.resolveDeviceIdentifier(dto.deviceFingerprint, dto.ipAddress),
      sessionMetadata: dto.metadata,
      userAgent: dto.userAgent,
      ipAddress: dto.ipAddress,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return response;
  }

  async me(userId: string): Promise<AuthResponse> {
    const user = await this.usersService.findById(userId);
    return this.buildAuthResponse(user, {});
  }

  async requestOtp(dto: RequestOtpInput): Promise<OtpIssueResponse> {
    const user = await this.findActiveUserByEmail(this.normalizeEmail(dto.email));
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }

    const deviceFingerprint = this.resolveDeviceIdentifier(dto.deviceFingerprint, dto.ipAddress);

    await this.enforceDeviceRateLimit(user.id, deviceFingerprint);
    await this.enforceOtpCooldown(user.id, dto.purpose, deviceFingerprint);

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
        deviceFingerprint,
        deliveryProvider: delivery.provider,
        deliveryReference: delivery.referenceId,
        deliveryMetadata: this.buildMetadata(delivery.metadata),
        deliveredAt: delivery.deliveredAt,
      },
    });

    if (deviceFingerprint) {
      await this.upsertDeviceSession(user.id, deviceFingerprint, dto, { lastIssuedAt: new Date() });
    }

    return { message: 'OTP issued', channel: delivery.channel, deliveredAt: delivery.deliveredAt };
  }

  async verifyOtp(dto: VerifyOtpInput): Promise<AuthResponse> {
    const user = await this.findActiveUserByEmail(this.normalizeEmail(dto.email));
    if (!user) {
      throw new UnauthorizedException('Invalid code');
    }

    const deviceFingerprint = this.resolveDeviceIdentifier(dto.deviceFingerprint, dto.ipAddress);
    const channel = this.resolveChannel(dto.channel, user);

    const consumedAt = await this.consumeOtp(user, dto, { deviceFingerprint, channel });

    if (deviceFingerprint) {
      await this.upsertDeviceSession(user.id, deviceFingerprint, dto, { lastVerifiedAt: consumedAt });
    }

    return this.buildAuthResponse(user, { sessionFingerprint: deviceFingerprint, userAgent: dto.userAgent, ipAddress: dto.ipAddress, sessionMetadata: dto.metadata });
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

    const deviceFingerprint = this.resolveDeviceIdentifier(dto.deviceFingerprint, dto.ipAddress);
    const channel = this.resolveChannel(dto.channel, user);

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
        channel,
      },
      { deviceFingerprint, channel },
    );

    const passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash, tokenVersion: { increment: 1 } } }),
      ...(deviceFingerprint
        ? [this.upsertDeviceSession(user.id, deviceFingerprint, dto, { lastVerifiedAt: consumedAt })]
        : []),
      this.prisma.deviceSession.updateMany({ where: { userId: user.id }, data: { status: 'REVOKED' } }),
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

  private async buildAuthResponse(
    user: SafeUser | ({ passwordHash: string } & SafeUser),
    options: {
      rememberMe?: boolean;
      sessionFingerprint?: string | null;
      sessionMetadata?: Record<string, unknown>;
      userAgent?: string;
      ipAddress?: string;
    },
  ): Promise<AuthResponse> {
    const safeUser = sanitizeUser(user)!;
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    const defaultTtlValue = Number(this.configService.get<string>('JWT_TTL') ?? 86400);
    const rememberTtlValue = Number(this.configService.get<string>('JWT_TTL_REMEMBER') ?? 2_592_000);
    const rawTtl = options.rememberMe ? rememberTtlValue : defaultTtlValue;
    const expiresIn = Number.isNaN(rawTtl) ? defaultTtlValue : rawTtl;
    const token = await this.jwtService.signAsync(
      { sub: safeUser.id, role: safeUser.role, tokenVersion: safeUser.tokenVersion },
      {
        secret,
        expiresIn,
      },
    );

    if (options.sessionFingerprint) {
      await this.upsertDeviceSession(safeUser.id, options.sessionFingerprint, {
        deviceFingerprint: options.sessionFingerprint,
        userAgent: options.userAgent,
        ipAddress: options.ipAddress,
        metadata: options.sessionMetadata,
      }, {
        lastActiveAt: new Date(),
      }, this.hashToken(token));
    }

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
    timestamps: Partial<{ lastIssuedAt: Date; lastVerifiedAt: Date; lastActiveAt: Date; status: DeviceSessionStatus }>,
    sessionTokenHash?: string,
  ) {
    const metadata = this.buildMetadata(payload.metadata);
    const base = {
      userAgent: payload.userAgent,
      ipAddress: payload.ipAddress,
      ...(sessionTokenHash ? { sessionTokenHash } : {}),
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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async consumeOtp(
    user: User,
    dto: VerifyOtpInput,
    context: { deviceFingerprint: string | null; channel: NotificationChannel },
  ): Promise<Date> {
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        purpose: dto.purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        deviceFingerprint: context.deviceFingerprint,
        channel: context.channel,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new UnauthorizedException('Invalid code');
    }

    if (otpRecord.attempts >= 3) {
      throw new UnauthorizedException('Too many invalid attempts');
    }

    const matches = await bcrypt.compare(dto.code, otpRecord.codeHash);
    if (!matches) {
      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid code');
    }

    const consumedAt = new Date();
    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { consumedAt },
    });

    return consumedAt;
  }

  private async enforceDeviceRateLimit(userId: string, fingerprint: string | null): Promise<void> {
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

  private enforceLoginAttemptLimit(email: string): void {
    const limitValue = Number(this.configService.get<string>('LOGIN_ATTEMPT_LIMIT') ?? 5);
    const windowValue = Number(this.configService.get<string>('LOGIN_ATTEMPT_WINDOW_MS') ?? 900_000);
    const limit = Number.isNaN(limitValue) ? 5 : limitValue;
    const windowMs = Number.isNaN(windowValue) ? 900_000 : windowValue;
    this.rateLimitService.enforce(`login-fail:${email}`, limit, windowMs);
  }

  private async enforceOtpCooldown(userId: string, purpose: OtpPurpose, fingerprint: string | null): Promise<void> {
    const cooldownValue = Number(this.configService.get<string>('OTP_COOLDOWN_SECONDS') ?? 60);
    const cooldownMs = Number.isNaN(cooldownValue) ? 60_000 : cooldownValue * 1000;
    const lastIssued = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, deviceFingerprint: fingerprint ?? undefined },
      orderBy: { createdAt: 'desc' },
    });

    if (lastIssued && Date.now() - lastIssued.createdAt.getTime() < cooldownMs) {
      throw new HttpException('OTP recently sent. Please wait before requesting again.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private resolveDeviceIdentifier(deviceFingerprint?: string, ipAddress?: string): string | null {
    const trimmedFingerprint = deviceFingerprint?.trim();
    if (trimmedFingerprint) {
      return trimmedFingerprint;
    }

    if (ipAddress?.trim()) {
      return `ip:${ipAddress.trim()}`;
    }

    return null;
  }

  private resolveChannel(requestedChannel: NotificationChannel | undefined, user: User): NotificationChannel {
    if (requestedChannel) {
      return requestedChannel;
    }

    return user.phone ? NotificationChannel.SMS : NotificationChannel.EMAIL;
  }
}
