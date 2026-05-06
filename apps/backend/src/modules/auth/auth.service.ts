import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
} from "../../common/dtos/auth.dto";
import { SafeUser, sanitizeUser } from "../users/user.serializer";

import { PrismaService } from "../../prisma/prisma.service";
import { RateLimitService } from "../../common/services/rate-limit.service";
import { UsersService } from "../users/users.service";
import { OtpDeliveryService } from "./otp-delivery.service";
import { NotificationsService } from "../notifications/notifications.service";

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
    private readonly notifications: NotificationsService,
  ) { }

  async register(dto: RegisterInput): Promise<{ message: string }> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const existing = await this.findActiveUserByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    const emailVerificationToken = randomBytes(32).toString('hex');

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: normalizedEmail,
        passwordHash,
        phone: dto.phone,
        emailVerified: false,
        emailVerificationToken,
      },
    });

    await this.ensureUserProfile(user.id);
    await this.sendVerificationEmailForUser(user.email, user.name, emailVerificationToken);

    return { message: 'Registration successful. Please check your email to verify your account.' };
  }

  async login(dto: LoginInput): Promise<AuthResponse> {
    const normalizedEmail = this.normalizeEmail(dto.email);

    // Reject immediately if the account is in a lockout period
    if (this.rateLimitService.isLocked(`login-lockout:${normalizedEmail}`)) {
      throw new HttpException('Account temporarily locked due to too many failed attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

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

    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in. Check your inbox for the verification link.');
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

  async changePassword(userId: string, dto: { currentPassword: string; newPassword: string }): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.passwordHash) {
      throw new UnauthorizedException('Password change is not supported for accounts created via OAuth');
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });

    return { message: 'Password changed successfully' };
  }

  async listDeviceSessions(userId: string) {
    await this.ensureExists(userId);
    return this.prisma.deviceSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async buildAuthResponse(
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

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: token, deletedAt: null },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.emailVerified) {
      return { message: 'Email already verified' };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerificationToken: null },
    });

    return { message: 'Email verified successfully. You can now log in.' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const normalizedEmail = this.normalizeEmail(email);

    // Rate-limit to 3 resends per hour per email address
    this.rateLimitService.enforce(`resend-verification:${normalizedEmail}`, 3, 3_600_000);

    const user = await this.findActiveUserByEmail(normalizedEmail);
    // Return a generic message regardless of whether the account exists to avoid enumeration
    if (!user || user.emailVerified) {
      return { message: 'If that email exists and is unverified, a new link has been sent.' };
    }

    const emailVerificationToken = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken },
    });

    await this.sendVerificationEmailForUser(user.email, user.name, emailVerificationToken);

    return { message: 'If that email exists and is unverified, a new link has been sent.' };
  }

  private async sendVerificationEmailForUser(email: string, name: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const link = `${frontendUrl}/verify-email?token=${token}`;
    await this.notifications.sendVerificationEmail(email, name, link);
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

    // Check explicit lockout first (set when limit is reached)
    if (this.rateLimitService.isLocked(`login-lockout:${email}`)) {
      throw new HttpException('Account temporarily locked due to too many failed attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Enforce sliding-window rate limit; when limit is hit, apply a lockout
    const currentCount = this.rateLimitService.getCount(`login-fail:${email}`, windowMs);
    if (currentCount >= limit - 1) {
      // This attempt will push us to or past the limit — apply lockout
      const lockoutMs = windowMs * 2; // lock for twice the window
      this.rateLimitService.lock(`login-lockout:${email}`, lockoutMs);
    }

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

  async validateOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<User> {
    const normalizedEmail = this.normalizeEmail(profile.email);

    // Check if user exists by email
    let user = await this.findActiveUserByEmail(normalizedEmail);

    if (user) {
      // User exists, just return them
      return user;
    }

    // Create new user with Google OAuth
    user = await this.prisma.user.create({
      data: {
        name: profile.name,
        email: normalizedEmail,
        passwordHash: '', // No password for OAuth users
        avatarUrl: profile.avatarUrl,
        kycStatus: 'NOT_REQUIRED', // OAuth users are pre-verified by Google
        emailVerified: true, // Google already verified this address
      },
    });

    await this.ensureUserProfile(user.id);

    return user;
  }
}
