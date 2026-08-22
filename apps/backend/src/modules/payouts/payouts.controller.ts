import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { PayoutStatus } from "@prisma/client";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { PayoutsService } from "./payouts.service";

interface AuthRequest {
  user: { id: string };
}

@ApiTags("payouts")
@Controller("payouts")
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  // ─── Seller: Start Connect onboarding ────────────────────────────────────

  @Post("onboard")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Generate Stripe Connect onboarding link for the authenticated seller",
  })
  async startOnboarding(@Req() req: AuthRequest): Promise<{ url: string }> {
    return this.payoutsService.createConnectedAccount(req.user.id);
  }

  // ─── Stripe Connect redirect callback ─────────────────────────────────────
  // GET is called by Stripe redirect (browser) — do not mutate, just inform frontend.
  // Actual onboarding status update is done via POST with auth.

  @Get("onboard/callback")
  @ApiOperation({ summary: "Stripe Connect onboarding redirect (browser)" })
  async handleOnboardCallbackGet(
    @Query("accountId") accountId: string,
    @Query("refresh") refresh: string,
  ): Promise<{ status: string }> {
    if (!accountId) {
      return { status: "missing_account_id" };
    }
    if (refresh === "true") {
      return { status: "refresh_required" };
    }
    return { status: "pending_verification" };
  }

  @Post("onboard/callback")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Refresh Stripe Connect onboarding status (authenticated)",
  })
  async handleOnboardCallbackPost(
    @Req() req: AuthRequest,
    @Body() body: { accountId: string },
  ): Promise<{ status: string }> {
    const accountId = body.accountId;
    if (!accountId) {
      return { status: "missing_account_id" };
    }
    const onboardStatus =
      await this.payoutsService.refreshConnectAccountStatus(accountId);
    return { status: onboardStatus };
  }

  // ─── Seller: Payout history ────────────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated seller's payout history" })
  getPayoutHistory(
    @Req() req: AuthRequest,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
    @Query("status") status?: PayoutStatus,
  ) {
    return this.payoutsService.getPayoutHistory(req.user.id, {
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
      status,
    });
  }

  // ─── Seller: Available balance ─────────────────────────────────────────────

  @Get("balance")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get the authenticated seller's available payout balance",
  })
  getBalance(@Req() req: AuthRequest) {
    return this.payoutsService.getAvailableBalance(req.user.id);
  }

  // ─── Admin: Manually trigger payout processing ────────────────────────────

  @Post("admin/process")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "(Admin) Manually trigger processing of a specific payout",
  })
  async adminProcessPayout(
    @Body() body: { payoutId: string },
  ): Promise<{ success: boolean }> {
    await this.payoutsService.processPayout(body.payoutId);
    return { success: true };
  }

  // ─── Admin: Manually trigger the batch scheduler ──────────────────────────

  @Post("admin/schedule")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "(Admin) Manually run the payout scheduler to create pending payouts",
  })
  async adminSchedulePayouts(): Promise<{ success: boolean }> {
    await this.payoutsService.schedulePayouts();
    return { success: true };
  }

  // ─── Paystack: List supported banks ───────────────────────────────────────

  @Get("paystack/banks")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "List Paystack-supported banks for a given currency (for seller onboarding)",
  })
  listPaystackBanks(@Query("currency") currency = "ZAR"): Promise<unknown[]> {
    return this.payoutsService.listPaystackBanks(currency);
  }
}
