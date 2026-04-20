import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PayoutStatus } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PayoutsService } from './payouts.service';

interface AuthRequest {
  user: { id: string };
}

@ApiTags('payouts')
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  // ─── Seller: Start Connect onboarding ────────────────────────────────────

  @Post('onboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate Stripe Connect onboarding link for the authenticated seller' })
  async startOnboarding(@Req() req: AuthRequest): Promise<{ url: string }> {
    return this.payoutsService.createConnectedAccount(req.user.id);
  }

  // ─── Stripe Connect redirect callback ─────────────────────────────────────
  // No auth guard — Stripe (or user's browser) redirects here after onboarding.

  @Get('onboard/callback')
  @ApiOperation({ summary: 'Handle Stripe Connect onboarding redirect' })
  async handleOnboardCallback(
    @Query('accountId') accountId: string,
    @Query('refresh') refresh: string,
  ): Promise<{ status: string }> {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    if (!accountId) {
      // Stripe sent back without an accountId — redirect to frontend with error
      return { status: 'missing_account_id' };
    }

    // On refresh the user needs a new onboarding link; re-create via the same endpoint
    if (refresh === 'true') {
      return { status: 'refresh_required' };
    }

    const onboardStatus = await this.payoutsService.refreshConnectAccountStatus(accountId);
    return { status: onboardStatus };
  }

  // ─── Seller: Payout history ────────────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated seller's payout history" })
  getPayoutHistory(
    @Req() req: AuthRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: PayoutStatus,
  ) {
    return this.payoutsService.getPayoutHistory(req.user.id, {
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
      status,
    });
  }

  // ─── Seller: Available balance ─────────────────────────────────────────────

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated seller's available payout balance" })
  getBalance(@Req() req: AuthRequest) {
    return this.payoutsService.getAvailableBalance(req.user.id);
  }

  // ─── Admin: Manually trigger payout processing ────────────────────────────

  @Post('admin/process')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '(Admin) Manually trigger processing of a specific payout' })
  async adminProcessPayout(@Body() body: { payoutId: string }): Promise<{ success: boolean }> {
    await this.payoutsService.processPayout(body.payoutId);
    return { success: true };
  }

  // ─── Admin: Manually trigger the batch scheduler ──────────────────────────

  @Post('admin/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '(Admin) Manually run the payout scheduler to create pending payouts' })
  async adminSchedulePayouts(): Promise<{ success: boolean }> {
    await this.payoutsService.schedulePayouts();
    return { success: true };
  }
}
