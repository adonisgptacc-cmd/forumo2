import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Response } from "express";
import type { Request as ExpressRequest } from "express";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";

import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { TwoFactorPendingGuard } from "./guards/two-factor-pending.guard";
import { SkipTosCheck } from "../../common/decorators/skip-tos-check.decorator";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { AuthService } from "./auth.service";
import {
  LoginDto,
  PasswordResetConfirmDto,
  RecoverOAuthAccountConfirmDto,
  RegisterDto,
  RequestOtpDto,
  RequestPasswordResetDto,
  VerifyOtpDto,
} from "../../common/dtos/auth.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuditLogService } from "../observability/audit-log.service";

type AuthenticatedRequest = ExpressRequest & {
  user: Record<string, unknown> & { id: string; email: string; role: string };
  cookies?: Record<string, string>;
  twoFactorUserId?: string;
  twoFactorSetupRequired?: boolean;
} & Record<string, unknown>;

@Controller("auth")
@SkipTosCheck()
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLog: AuditLogService,
    private readonly configService: ConfigService,
  ) {}

  @Post("register")
  @Throttle({ auth: {} })
  async register(@Body() dto: RegisterDto, @Req() req: AuthenticatedRequest) {
    const result = await this.authService.register(dto);
    await this.auditLog.record({
      action: "auth.register",
      entityType: "user",
      payload: { email: dto.email },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
    return result;
  }

  @Post("login")
  @Throttle({ "auth-login": {} })
  async login(@Body() dto: LoginDto, @Req() req: AuthenticatedRequest) {
    const result = await this.authService.login(dto);
    // Only audit after full authentication (post-2FA); partial tokens skip audit here
    if ("user" in result) {
      await this.auditLog.record({
        actorId: result.user.id,
        action: "auth.login",
        entityType: "user",
        entityId: result.user.id,
        payload: { identifier: dto.identifier },
        ipAddress: req.ip ?? null,
        userAgent: req.headers?.["user-agent"] ?? null,
      });
    }
    return result;
  }

  @Post("otp/request")
  @Throttle({ "auth-otp": {} })
  async requestOtp(
    @Body() dto: RequestOtpDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.authService.requestOtp(dto);
    await this.auditLog.record({
      action: "auth.otp.request",
      entityType: "user",
      payload: { identifier: dto.identifier, purpose: dto.purpose },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
    return result;
  }

  @Post("otp/verify")
  @Throttle({ auth: {} })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: AuthenticatedRequest) {
    const result = await this.authService.verifyOtp(dto);
    await this.auditLog.record({
      actorId: result.user.id,
      action: "auth.otp.verify",
      entityType: "user",
      entityId: result.user.id,
      payload: { purpose: dto.purpose },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
    return result;
  }

  @Post("verify-email")
  verifyEmail(@Body() body: { token: string }) {
    if (!body.token) throw new BadRequestException("token is required");
    return this.authService.verifyEmail(body.token);
  }

  @Post("resend-verification")
  @Throttle({ "auth-resend": {} })
  resendVerification(@Body() body: { email: string }) {
    if (!body.email) throw new BadRequestException("email is required");
    return this.authService.resendVerification(body.email);
  }

  @Post("recover-oauth-account/request")
  @Throttle({ "auth-password-reset": {} })
  async recoverOAuthAccountRequest(@Body() body: { email: string }) {
    if (!body.email) throw new BadRequestException("email is required");
    return this.authService.requestOAuthAccountRecovery(body.email);
  }

  @Post("recover-oauth-account/confirm")
  @Throttle({ "auth-password-reset": {} })
  async recoverOAuthAccountConfirm(@Body() dto: RecoverOAuthAccountConfirmDto) {
    return this.authService.confirmOAuthAccountRecovery(
      dto.email,
      dto.code,
      dto.newPassword,
      dto.phone,
    );
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return this.authService.me(req.user.id);
  }

  @Post("password/reset/request")
  @Throttle({ "auth-password-reset": {} })
  async requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.authService.requestPasswordReset(dto);
    await this.auditLog.record({
      action: "auth.password.reset.request",
      entityType: "user",
      payload: { identifier: dto.identifier },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
    return result;
  }

  @Post("password/reset/confirm")
  @Throttle({ "auth-password-reset": {} })
  async confirmPasswordReset(
    @Body() dto: PasswordResetConfirmDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.authService.confirmPasswordReset(dto);
    await this.auditLog.record({
      action: "auth.password.reset.confirm",
      entityType: "user",
      payload: { identifier: dto.identifier },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
    return result;
  }

  @Post("password/change")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    const result = await this.authService.changePassword(req.user.id, body);
    res.clearCookie("refresh_token");
    await this.auditLog.record({
      actorId: req.user.id,
      action: "auth.password.change",
      entityType: "user",
      entityId: req.user.id,
      payload: {},
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
    return result;
  }

  @Post("refresh")
  async refresh(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken = (req.cookies as Record<string, string>)?.[
      "refresh_token"
    ];
    const authHeader = req.headers?.["authorization"] as string | undefined;
    const headerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;

    const token = cookieToken || headerToken;
    if (!token) throw new UnauthorizedException("No refresh token provided");

    const result = await this.authService.refreshToken(token);

    const isProd = this.configService.get<string>("NODE_ENV") === "production";
    res.cookie("refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies as Record<string, string>)?.[
      "refresh_token"
    ];
    await this.authService.logout(req.user.id, refreshToken);
    res.clearCookie("refresh_token");
    await this.auditLog.record({
      actorId: req.user.id,
      action: "auth.logout",
      entityType: "user",
      entityId: req.user.id,
      payload: {},
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
    return { message: "Logged out successfully" };
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  listOwnSessions(@Req() req: AuthenticatedRequest) {
    return this.authService.listDeviceSessions(req.user.id);
  }

  @Get("sessions/:userId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  listSessionsForUser(@Param("userId", new ParseUUIDPipe()) userId: string) {
    return this.authService.listDeviceSessions(userId);
  }

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const user = req.user as unknown as import("@prisma/client").User;
    const result = await this.authService.buildAuthResponse(
      user as unknown as Parameters<AuthService["buildAuthResponse"]>[0],
      {},
    );

    await this.auditLog.record({
      actorId: user.id,
      action: "auth.google.login",
      entityType: "user",
      entityId: user.id,
      payload: { email: user.email },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });

    const frontendUrl =
      this.configService.get<string>("FRONTEND_URL") || "http://localhost:3000";
    const isProd = this.configService.get<string>("NODE_ENV") === "production";
    res.cookie("oauth_token", result.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 5 * 60 * 1000,
    });
    res.redirect(`${frontendUrl}/auth/callback`);
  }

  /** Exchange the short-lived oauth_token cookie for a bearer token (one-time use). */
  @Get("oauth/exchange")
  exchangeOAuthCookie(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies as Record<string, string>)?.["oauth_token"];
    if (!token) throw new UnauthorizedException("No OAuth token cookie found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: External SDK or dynamic payload requires flexible typing, TODO: refine to specific type
    (res as any).clearCookie("oauth_token");
    return { accessToken: token };
  }
  // ─── Two-Factor Authentication ─────────────────────────────────────────────

  @Post("2fa/setup-init")
  @UseGuards(TwoFactorPendingGuard)
  @Throttle({ auth: {} })
  async twoFactorSetupInit(@Req() req: AuthenticatedRequest) {
    if (!req.twoFactorSetupRequired) {
      throw new BadRequestException(
        "2FA already configured; use /auth/2fa/verify to log in",
      );
    }
    return this.authService.initSetup2FA(req.twoFactorUserId!);
  }

  @Post("2fa/setup-verify")
  @UseGuards(TwoFactorPendingGuard)
  @Throttle({ auth: {} })
  async twoFactorSetupVerify(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: { code: string; rememberMe?: boolean; deviceFingerprint?: string },
  ) {
    if (!req.twoFactorSetupRequired) {
      throw new BadRequestException(
        "2FA already configured; use /auth/2fa/verify to log in",
      );
    }
    const result = await this.authService.verifySetup2FA(
      req.twoFactorUserId!,
      body.code,
      {
        rememberMe: body.rememberMe,
        deviceFingerprint: body.deviceFingerprint,
        ipAddress: req.ip ?? undefined,
        userAgent:
          (req.headers?.["user-agent"] as string | undefined) ?? undefined,
      },
    );
    await this.auditLog.record({
      actorId: result.user.id,
      action: "auth.2fa.setup",
      entityType: "user",
      entityId: result.user.id,
      payload: {},
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
    return result;
  }

  @Post("2fa/verify")
  @UseGuards(TwoFactorPendingGuard)
  @Throttle({ auth: {} })
  async twoFactorVerify(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: { code: string; rememberMe?: boolean; deviceFingerprint?: string },
  ) {
    if (req.twoFactorSetupRequired) {
      throw new BadRequestException(
        "2FA not set up yet; use /auth/2fa/setup-init first",
      );
    }
    const result = await this.authService.completeTwoFactorLogin(
      req.twoFactorUserId!,
      body.code,
      {
        rememberMe: body.rememberMe,
        deviceFingerprint: body.deviceFingerprint,
        ipAddress: req.ip ?? undefined,
        userAgent:
          (req.headers?.["user-agent"] as string | undefined) ?? undefined,
      },
    );
    await this.auditLog.record({
      actorId: result.user.id,
      action: "auth.login",
      entityType: "user",
      entityId: result.user.id,
      payload: { via: "2fa" },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
    return result;
  }

  @Post("2fa/otp/request")
  @UseGuards(TwoFactorPendingGuard)
  @Throttle({ "auth-otp": {} })
  async twoFactorOtpRequest(@Req() req: AuthenticatedRequest) {
    if (req.twoFactorSetupRequired) {
      throw new BadRequestException(
        "2FA not set up yet; use /auth/2fa/setup-init first",
      );
    }
    return this.authService.requestTwoFactorOtp(req.twoFactorUserId!);
  }

  @Post("2fa/otp/verify")
  @UseGuards(TwoFactorPendingGuard)
  @Throttle({ "auth-otp": {} })
  async twoFactorOtpVerify(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: { code: string; rememberMe?: boolean; deviceFingerprint?: string },
  ) {
    if (req.twoFactorSetupRequired) {
      throw new BadRequestException(
        "2FA not set up yet; use /auth/2fa/setup-init first",
      );
    }
    const result = await this.authService.completeTwoFactorOtpLogin(
      req.twoFactorUserId!,
      body.code,
      {
        rememberMe: body.rememberMe,
        deviceFingerprint: body.deviceFingerprint,
        ipAddress: req.ip ?? undefined,
        userAgent:
          (req.headers?.["user-agent"] as string | undefined) ?? undefined,
      },
    );
    await this.auditLog.record({
      actorId: result.user.id,
      action: "auth.login",
      entityType: "user",
      entityId: result.user.id,
      payload: { via: "2fa-otp" },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
    return result;
  }

  @Post("2fa/disable")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  async twoFactorDisable(
    @Req() req: AuthenticatedRequest,
    @Body() body: { code: string; password: string },
  ) {
    const result = await this.authService.disable2FA(
      req.user.id,
      body.code,
      body.password,
    );
    await this.auditLog.record({
      actorId: req.user.id,
      action: "auth.2fa.disable",
      entityType: "user",
      entityId: req.user.id,
      payload: {},
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
    return result;
  }
}
