import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
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
import { UsersService } from "../users/users.service";
import { OtpDeliveryService } from "./otp-delivery.service";
import { NotificationsService } from "../notifications/notifications.service";

interface OtpIssueResponse {
  message: string;
  channel: NotificationChannel;
  deliveredAt: Date;
}

export type LoginResult =
  | { twoFactorRequired: true; twoFactorToken: string }
  | { twoFactorSetupRequired: true; twoFactorToken: string }
  | AuthResponse;

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly otpDeliveryService: OtpDeliveryService,
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

  async login(dto: LoginInput): Promise<LoginResult> {
    const normalizedEmail = this.normalizeEmail(dto.email);

    const user = await this.findActiveUserByEmail(normalizedEmail);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in. Check your inbox for the verification link.');
    }

    // ── 2FA gate ────────────────────────────────────────────────────────────
    const twoFactorToken = await this.issueTwoFactorToken(
      user.id,
      !user.twoFactorEnabled,
    );

    if (user.twoFactorEnabled) {
      return { twoFactorRequired: true, twoFactorToken };
    }
    return { twoFactorSetupRequired: true, twoFactorToken };
  }

  /** Complete login after 2FA TOTP verification. */
  async completeTwoFactorLogin(
    userId: string,
    code: string,
    dto: Partial<Pick<LoginInput, 'rememberMe' | 'deviceFingerprint' | 'ipAddress' | 'userAgent'>> & { metadata?: Record<string, unknown> } = {},
  ): Promise<AuthResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const valid = authenticator.verify({ token: code, secret: user.twoFactorSecret! });
    if (!valid) {
      // Check backup codes
      const idx = (user.twoFactorBackupCodes ?? []).findIndex(
        (h) => h === createHash('sha256').update(code).digest('hex'),
      );
      if (idx === -1) throw new UnauthorizedException('Invalid authentication code');
      // Consume the backup code (one-time use)
      const remaining = [...(user.twoFactorBackupCodes ?? [])];
      remaining.splice(idx, 1);
      await this.prisma.user.update({ where: { id: userId }, data: { twoFactorBackupCodes: remaining } });
    }

    const fullUser = await this.findActiveUserByEmail(user.email);
    const response = await this.buildAuthResponse(fullUser!, {
      rememberMe: dto.rememberMe,
      sessionFingerprint: this.resolveDeviceIdentifier(dto.deviceFingerprint, dto.ipAddress),
      sessionMetadata: dto.metadata,
      userAgent: dto.userAgent,
      ipAddress: dto.ipAddress,
    });

    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    return response;
  }

  async me(userId: string): Promise<Pick<AuthResponse, 'user'>> {
    const user = await this.usersService.findById(userId);
    return { user: sanitizeUser(user)! };
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
      // Revoke all OTHER sessions; exclude the current device so it stays verified
      this.prisma.deviceSession.updateMany({
        where: {
          userId: user.id,
          ...(deviceFingerprint ? { fingerprint: { not: deviceFingerprint } } : {}),
        },
        data: { status: 'REVOKED' },
      }),
      ...(deviceFingerprint
        ? [this.upsertDeviceSession(user.id, deviceFingerprint, dto, { lastVerifiedAt: consumedAt })]
        : []),
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
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      }),
      this.prisma.deviceSession.updateMany({
        where: { userId },
        data: { refreshTokenHash: null },
      }),
    ]);

    return { message: 'Password changed successfully' };
  }

  async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');

    let payload: { sub: string; fingerprint?: string; tokenVersion: number; type: string };
    try {
      payload = await this.jwtService.verifyAsync(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findFirst({ where: { id: payload.sub, deletedAt: null } });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.tokenVersion !== payload.tokenVersion) throw new UnauthorizedException('Token has been revoked');

    if (payload.fingerprint) {
      const session = await this.prisma.deviceSession.findFirst({
        where: { userId: payload.sub, fingerprint: payload.fingerprint, status: 'ACTIVE' },
      });
      if (!session) throw new UnauthorizedException('Session not found or revoked');
      if (session.refreshTokenHash !== this.hashToken(token)) {
        throw new UnauthorizedException('Refresh token has been rotated');
      }
    }

    const newAccessToken = await this.jwtService.signAsync(
      { sub: user.id, role: user.role, tokenVersion: user.tokenVersion },
      { secret, expiresIn: 900 },
    );

    const newRefreshToken = await this.jwtService.signAsync(
      { sub: user.id, fingerprint: payload.fingerprint, tokenVersion: user.tokenVersion, type: 'refresh' },
      { secret, expiresIn: 2_592_000 },
    );

    if (payload.fingerprint) {
      await this.prisma.deviceSession.update({
        where: { userId_fingerprint: { userId: user.id, fingerprint: payload.fingerprint } },
        data: {
          refreshTokenHash: this.hashToken(newRefreshToken),
          sessionTokenHash: this.hashToken(newAccessToken),
          lastActiveAt: new Date(),
        },
      });
    }

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');

    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync<{ sub: string; fingerprint?: string }>(refreshToken, { secret });
        if (payload.fingerprint) {
          await this.prisma.deviceSession.update({
            where: { userId_fingerprint: { userId, fingerprint: payload.fingerprint } },
            data: { status: 'REVOKED', refreshTokenHash: null },
          });
        }
      } catch {
        // Token is invalid — still increment tokenVersion to be safe
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
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

    const accessToken = await this.jwtService.signAsync(
      { sub: safeUser.id, role: safeUser.role, tokenVersion: safeUser.tokenVersion },
      { secret, expiresIn: 900 }, // 15 minutes
    );

    let refreshToken: string | undefined;
    if (options.sessionFingerprint) {
      refreshToken = await this.jwtService.signAsync(
        { sub: safeUser.id, fingerprint: options.sessionFingerprint, tokenVersion: safeUser.tokenVersion, type: 'refresh' },
        { secret, expiresIn: 2_592_000 }, // 30 days
      );

      await this.upsertDeviceSession(
        safeUser.id,
        options.sessionFingerprint,
        {
          deviceFingerprint: options.sessionFingerprint,
          userAgent: options.userAgent,
          ipAddress: options.ipAddress,
          metadata: options.sessionMetadata,
        },
        { lastActiveAt: new Date() },
        this.hashToken(accessToken),
        this.hashToken(refreshToken),
      );
    }

    return { user: safeUser, accessToken, ...(refreshToken ? { refreshToken } : {}) };
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
    refreshTokenHash?: string,
  ) {
    const metadata = this.buildMetadata(payload.metadata);
    const base = {
      userAgent: payload.userAgent,
      ipAddress: payload.ipAddress,
      ...(sessionTokenHash ? { sessionTokenHash } : {}),
      ...(refreshTokenHash ? { refreshTokenHash } : {}),
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

    const windowStart = new Date(Date.now() - windowSeconds * 1000);

    if (fingerprint) {
      const recentCount = await this.prisma.otpCode.count({
        where: { userId, deviceFingerprint: fingerprint, createdAt: { gte: windowStart } },
      });
      if (recentCount >= limit) {
        throw new HttpException('Too many OTP requests for this device', HttpStatus.TOO_MANY_REQUESTS);
      }
    } else {
      // No fingerprint — fall back to a per-user global limit to prevent enumeration
      const recentCount = await this.prisma.otpCode.count({
        where: { userId, createdAt: { gte: windowStart } },
      });
      if (recentCount >= limit) {
        throw new HttpException('Too many OTP requests', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!exists) {
      throw new UnauthorizedException('Account not found');
    }
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

    let user = await this.findActiveUserByEmail(normalizedEmail);

    if (user) {
      return user;
    }

    user = await this.prisma.user.create({
      data: {
        name: profile.name,
        email: normalizedEmail,
        passwordHash: '',
        avatarUrl: profile.avatarUrl,
        kycStatus: 'NOT_REQUIRED',
        emailVerified: true,
      },
    });

    await this.ensureUserProfile(user.id);

    return user;
  }
  // ─── Two-Factor Authentication ───────────────────────────────────────────────

  async issueTwoFactorToken(userId: string, setupRequired: boolean): Promise<string> {
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    return this.jwtService.signAsync(
      { sub: userId, twoFactorPending: true, twoFactorSetupRequired: setupRequired },
      { secret, expiresIn: 300 }, // 5 minutes
    );
  }

  async initSetup2FA(userId: string): Promise<{ qrCode: string; secret: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.twoFactorEnabled) throw new ForbiddenException('2FA already enabled');

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, 'Forumo', secret);
    const qrCode = await QRCode.toDataURL(otpAuthUrl);

    // Store secret temporarily (not yet enabled)
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });

    return { qrCode, secret };
  }

  async verifySetup2FA(
    userId: string,
    code: string,
    loginDto: Partial<Pick<LoginInput, 'rememberMe' | 'deviceFingerprint' | 'ipAddress' | 'userAgent'>> & { metadata?: Record<string, unknown> } = {},
  ): Promise<AuthResponse & { backupCodes: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret) throw new BadRequestException('2FA setup not initiated');
    if (user.twoFactorEnabled) throw new ForbiddenException('2FA already enabled');

    const valid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    if (!valid) throw new UnauthorizedException('Invalid authentication code. Try again.');

    // Generate 8 backup codes
    const plainCodes = Array.from({ length: 8 }, () =>
      randomBytes(4).toString('hex').toUpperCase().match(/.{4}/g)!.join('-'),
    );
    const hashedCodes = plainCodes.map((c) => createHash('sha256').update(c).digest('hex'));

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorBackupCodes: hashedCodes },
    });

    const fullUser = await this.findActiveUserByEmail(user.email);
    const response = await this.buildAuthResponse(fullUser!, {
      rememberMe: loginDto.rememberMe,
      sessionFingerprint: this.resolveDeviceIdentifier(loginDto.deviceFingerprint, loginDto.ipAddress),
      sessionMetadata: loginDto.metadata,
      userAgent: loginDto.userAgent,
      ipAddress: loginDto.ipAddress,
    });

    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    return { ...response, backupCodes: plainCodes };
  }

  async disable2FA(userId: string, code: string, password: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled) throw new BadRequestException('2FA is not enabled');

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) throw new UnauthorizedException('Invalid password');

    const validCode = authenticator.verify({ token: code, secret: user.twoFactorSecret! });
    if (!validCode) throw new UnauthorizedException('Invalid authentication code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
    });
    return { message: '2FA disabled successfully' };
  }

}
