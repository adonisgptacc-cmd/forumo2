import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import {
  LoginDto,
  PasswordResetConfirmDto,
  RegisterDto,
  RequestOtpDto,
  RequestPasswordResetDto,
  VerifyOtpDto,
} from "../../common/dtos/auth.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RateLimitService } from "../../common/services/rate-limit.service";
import { AuditLogService } from "../observability/audit-log.service";

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimit: RateLimitService,
    private readonly auditLog: AuditLogService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    this.applyRateLimit('register', req);
    const result = await this.authService.register(dto);
    await this.auditLog.record({
      actorId: result.user.id,
      action: 'auth.register',
      entityType: 'user',
      entityId: result.user.id,
      payload: { email: dto.email },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
    return result;
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: any) {
    this.applyRateLimit('login', req);
    const result = await this.authService.login(dto);
    await this.auditLog.record({
      actorId: result.user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: result.user.id,
      payload: { email: dto.email },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
    return result;
  }

  @Post('otp/request')
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: any) {
    this.applyRateLimit('otp', req);
    const result = await this.authService.requestOtp(dto);
    await this.auditLog.record({
      action: 'auth.otp.request',
      entityType: 'user',
      payload: { email: dto.email, purpose: dto.purpose },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
    return result;
  }

  @Post('otp/verify')
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: any) {
    this.applyRateLimit('otp', req);
    const result = await this.authService.verifyOtp(dto);
    await this.auditLog.record({
      actorId: result.user.id,
      action: 'auth.otp.verify',
      entityType: 'user',
      entityId: result.user.id,
      payload: { purpose: dto.purpose },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return this.authService.me(req.user.id);
  }

  @Post('password/reset/request')
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto, @Req() req: any) {
    this.applyRateLimit('password-reset', req);
    const result = await this.authService.requestPasswordReset(dto);
    await this.auditLog.record({
      action: 'auth.password.reset.request',
      entityType: 'user',
      payload: { email: dto.email },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
    return result;
  }

  @Post('password/reset/confirm')
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto, @Req() req: any) {
    this.applyRateLimit('password-reset', req);
    const result = await this.authService.confirmPasswordReset(dto);
    await this.auditLog.record({
      action: 'auth.password.reset.confirm',
      entityType: 'user',
      payload: { email: dto.email },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    });
    return result;
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  listOwnSessions(@Req() req: any) {
    return this.authService.listDeviceSessions(req.user.id);
  }

  @Get('sessions/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  listSessionsForUser(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.authService.listDeviceSessions(userId);
  }

  private applyRateLimit(action: string, req: any) {
    const limit = Number(this.configService.get<string>('AUTH_RATE_LIMIT') ?? 10);
    const windowMs = Number(this.configService.get<string>('AUTH_RATE_WINDOW_MS') ?? 60_000);
    const key = `auth:${action}:${req.ip ?? 'unknown'}`;
    this.rateLimit.enforce(key, Number.isNaN(limit) ? 10 : limit, Number.isNaN(windowMs) ? 60_000 : windowMs);
  }
}
