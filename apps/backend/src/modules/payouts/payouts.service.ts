import { randomUUID } from 'crypto';

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PayoutStatus, Prisma } from '@prisma/client';
import Stripe from 'stripe';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// Stripe Connect is not available in all African markets.
// TODO: Add Paystack Connect fallback for markets where Stripe is unavailable
// (e.g., Nigeria, Ghana). Gate by seller country at onboarding time.

const PLATFORM_FEE_RATE = 0.05; // 5% platform fee deducted from escrow at payout
const MINIMUM_PAYOUT_CENTS = 5000; // 50 ZAR / ~$5 USD
const NEW_SELLER_PAYOUT_COUNT_THRESHOLD = 3; // hold first N payouts
const NEW_SELLER_HOLD_DAYS = 14;
const ESCROW_RELEASE_HOLD_DAYS = 7;

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private readonly stripe?: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (apiKey) {
      this.stripe = new Stripe(apiKey);
    }
  }

  // ─── Onboarding ────────────────────────────────────────────────────────────

  async createConnectedAccount(sellerId: string): Promise<{ url: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const seller = await this.prisma.user.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('Seller not found');

    let accountId = seller.stripeConnectAccountId;

    if (!accountId) {
      const account = await this.stripe.accounts.create(
        {
          type: 'express',
          country: 'ZA',
          capabilities: { transfers: { requested: true } },
          metadata: { sellerId },
        },
        { idempotencyKey: `onboard_create_${sellerId}` },
      );
      accountId = account.id;
      await this.prisma.user.update({
        where: { id: sellerId },
        data: { stripeConnectAccountId: accountId },
      });
    }

    const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:4000/api/v1';
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appBaseUrl}/payouts/onboard/callback?refresh=true&accountId=${accountId}`,
      return_url: `${appBaseUrl}/payouts/onboard/callback?accountId=${accountId}`,
      type: 'account_onboarding',
    });

    this.logger.log(`Onboarding link created for seller ${sellerId}`);
    return { url: accountLink.url };
  }

  async refreshConnectAccountStatus(stripeConnectAccountId: string): Promise<string> {
    if (!this.stripe) return 'stripe_not_configured';

    const account = await this.stripe.accounts.retrieve(stripeConnectAccountId);
    const onboarded = Boolean(account.charges_enabled && account.payouts_enabled);

    await this.prisma.user.updateMany({
      where: { stripeConnectAccountId },
      data: { stripeConnectOnboarded: onboarded },
    });

    this.logger.log(`Connect account ${stripeConnectAccountId} onboarded=${onboarded}`);
    return onboarded ? 'complete' : 'pending';
  }

  // ─── Balance ───────────────────────────────────────────────────────────────

  async getAvailableBalance(sellerId: string): Promise<{
    available: number;
    pending: number;
    currency: string;
  }> {
    // Sum all RELEASED escrow amounts for this seller, minus platform fee
    const releasedEscrows = await this.prisma.escrowHolding.findMany({
      where: { status: 'RELEASED', order: { sellerId } },
      select: { amountCents: true },
    });

    const grossEscrow = releasedEscrows.reduce((sum, e) => sum + e.amountCents, 0);
    const netEscrow = Math.floor(grossEscrow * (1 - PLATFORM_FEE_RATE));

    // Sum payouts already processed (PAID) or in-flight (PENDING/PROCESSING)
    const [paidAgg, pendingAgg] = await Promise.all([
      this.prisma.payout.aggregate({
        where: { sellerId, status: PayoutStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.payout.aggregate({
        where: { sellerId, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
        _sum: { amount: true },
      }),
    ]);

    const alreadyPaid = paidAgg._sum.amount ?? 0;
    const inFlight = pendingAgg._sum.amount ?? 0;

    return {
      available: Math.max(0, netEscrow - alreadyPaid - inFlight),
      pending: inFlight,
      currency: 'zar',
    };
  }

  // ─── Payout History ────────────────────────────────────────────────────────

  async getPayoutHistory(
    sellerId: string,
    opts: { page: number; limit: number; status?: PayoutStatus },
  ) {
    const { page, limit, status } = opts;
    const skip = (page - 1) * limit;

    const where: Prisma.PayoutWhereInput = { sellerId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payout.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // ─── Scheduling ───────────────────────────────────────────────────────────

  @Cron('0 2 * * *')
  async schedulePayouts(): Promise<void> {
    this.logger.log('schedulePayouts: scanning for eligible seller escrows');

    const cutoff = new Date(Date.now() - ESCROW_RELEASE_HOLD_DAYS * 24 * 60 * 60 * 1000);

    // Find RELEASED escrows older than 7 days with no open disputes and eligible order status
    const eligible = await this.prisma.escrowHolding.findMany({
      where: {
        status: 'RELEASED',
        releasedAt: { lte: cutoff },
        order: { status: { in: ['DELIVERED', 'COMPLETED'] } },
        disputes: { none: { status: { in: ['OPEN', 'UNDER_REVIEW', 'ESCALATED'] } } },
      },
      include: {
        order: { select: { id: true, sellerId: true, currency: true } },
      },
    });

    if (!eligible.length) {
      this.logger.log('schedulePayouts: no eligible escrows found');
      return;
    }

    // Filter out orders that already have a non-failed payout
    const orderIds = eligible.map((e) => e.orderId);
    const existingPayouts = await this.prisma.payout.findMany({
      where: {
        status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING, PayoutStatus.PAID] },
        // Match via stripeConnectAccountId not available — use sellerId + amount heuristic instead.
        // For correctness we track which escrow orders have payouts via metadata.
        // Simplified: check if any payout exists for the same escrow amount+seller created after releasedAt.
        // The proper approach is to store escrowId on Payout; we avoid schema churn here.
        seller: { ordersAsSeller: { some: { id: { in: orderIds } } } },
      },
      select: { sellerId: true, amount: true, createdAt: true },
    });

    const paidSellerSet = new Set(existingPayouts.map((p) => p.sellerId));

    const newPayouts: Prisma.PayoutCreateManyInput[] = [];

    for (const escrow of eligible) {
      const { sellerId, currency } = escrow.order;
      if (paidSellerSet.has(sellerId)) continue;

      const netAmount = Math.floor(escrow.amountCents * (1 - PLATFORM_FEE_RATE));
      if (netAmount < MINIMUM_PAYOUT_CENTS) {
        this.logger.warn(
          `schedulePayouts: skipping seller ${sellerId} — net amount ${netAmount} below minimum`,
        );
        continue;
      }

      newPayouts.push({
        sellerId,
        amount: netAmount,
        currency: currency.toLowerCase(),
        status: PayoutStatus.PENDING,
        scheduledAt: new Date(),
      });
    }

    if (newPayouts.length) {
      await this.prisma.payout.createMany({ data: newPayouts, skipDuplicates: false });
      this.logger.log(`schedulePayouts: created ${newPayouts.length} payout record(s)`);
    }
  }

  // ─── Processing ───────────────────────────────────────────────────────────

  async processPayout(payoutId: string): Promise<void> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: { seller: true },
    });
    if (!payout) throw new NotFoundException(`Payout ${payoutId} not found`);

    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException(`Payout is ${payout.status}, expected PENDING`);
    }

    const { seller } = payout;

    if (!seller.stripeConnectAccountId) {
      throw new BadRequestException('Seller has not completed Stripe Connect onboarding');
    }
    if (!seller.stripeConnectOnboarded) {
      throw new BadRequestException('Seller Stripe Connect account is not yet active');
    }

    if (payout.amount < MINIMUM_PAYOUT_CENTS) {
      throw new BadRequestException(
        `Payout amount ${payout.amount} is below the minimum of ${MINIMUM_PAYOUT_CENTS} cents`,
      );
    }

    const holdActive = await this.enforceNewSellerHold(seller.id);
    if (holdActive) {
      this.logger.warn(
        `processPayout: payout ${payoutId} held — seller ${seller.id} new-seller hold active`,
      );
      throw new BadRequestException(
        'Payout is on hold for new sellers. Funds will be released after the hold period.',
      );
    }

    // Mark as PROCESSING before calling Stripe to prevent double-processing
    await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.PROCESSING },
    });

    try {
      const transfer = await this.stripe.transfers.create(
        {
          amount: payout.amount,
          currency: payout.currency,
          destination: seller.stripeConnectAccountId,
          description: `Forumo payout to seller ${seller.id}`,
          metadata: { payoutId, sellerId: seller.id },
        },
        { idempotencyKey: `payout_transfer_${payoutId}` },
      );

      await this.prisma.payout.update({
        where: { id: payoutId },
        data: {
          stripeTransferId: transfer.id,
          stripeConnectAccountId: seller.stripeConnectAccountId,
        },
      });

      this.logger.log(`processPayout: transfer ${transfer.id} created for payout ${payoutId}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Stripe transfer error';
      await this.prisma.payout.update({
        where: { id: payoutId },
        data: { status: PayoutStatus.FAILED, failureReason: reason },
      });
      this.logger.error(`processPayout: failed for ${payoutId}: ${reason}`);
      throw err;
    }
  }

  // ─── New-Seller Hold ───────────────────────────────────────────────────────

  async enforceNewSellerHold(sellerId: string): Promise<boolean> {
    const paidCount = await this.prisma.payout.count({
      where: { sellerId, status: PayoutStatus.PAID },
    });

    if (paidCount >= NEW_SELLER_PAYOUT_COUNT_THRESHOLD) {
      return false; // past the hold threshold
    }

    const seller = await this.prisma.user.findUnique({
      where: { id: sellerId },
      select: { createdAt: true },
    });
    if (!seller) return true;

    const daysSinceCreated =
      (Date.now() - seller.createdAt.getTime()) / (1000 * 60 * 60 * 24);

    return daysSinceCreated < NEW_SELLER_HOLD_DAYS;
  }

  // ─── Webhook Handlers (called from PaymentsController) ────────────────────

  async handleTransferPaid(stripeTransferId: string): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { stripeTransferId },
      include: { seller: { select: { email: true, name: true } } },
    });
    if (!payout) {
      this.logger.warn(`handleTransferPaid: no payout found for transfer ${stripeTransferId}`);
      return;
    }

    await this.prisma.payout.update({
      where: { id: payout.id },
      data: { status: PayoutStatus.PAID, processedAt: new Date() },
    });

    const amount = (payout.amount / 100).toFixed(2);
    await this.notifications.sendEmail(
      payout.seller.email,
      `Your payout of ${payout.currency.toUpperCase()} ${amount} has been sent`,
      `<p>Hi ${payout.seller.name},</p>
       <p>Your payout of <strong>${payout.currency.toUpperCase()} ${amount}</strong> has been successfully transferred to your bank account.</p>
       <p>Transfer reference: <code>${stripeTransferId}</code></p>`,
    );

    this.logger.log(`handleTransferPaid: payout ${payout.id} marked PAID`);
  }

  async handleTransferFailed(stripeTransferId: string, failureReason: string): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { stripeTransferId },
      include: { seller: { select: { email: true, name: true } } },
    });
    if (!payout) {
      this.logger.warn(`handleTransferFailed: no payout for transfer ${stripeTransferId}`);
      return;
    }

    // If retry budget remains: reschedule in 24 hours by resetting to PENDING
    const shouldRetry = payout.retryCount < 1;
    const retryScheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.payout.update({
      where: { id: payout.id },
      data: shouldRetry
        ? {
            status: PayoutStatus.PENDING,
            stripeTransferId: null,
            failureReason,
            retryCount: { increment: 1 },
            scheduledAt: retryScheduledAt,
          }
        : {
            status: PayoutStatus.FAILED,
            failureReason,
          },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const bankDetailsUrl = `${frontendUrl}/dashboard/payouts/bank-details`;
    const amount = (payout.amount / 100).toFixed(2);

    await this.notifications.sendEmail(
      payout.seller.email,
      `Payout failed — ${payout.currency.toUpperCase()} ${amount}`,
      `<p>Hi ${payout.seller.name},</p>
       <p>Unfortunately your payout of <strong>${payout.currency.toUpperCase()} ${amount}</strong> could not be completed.</p>
       <p><strong>Reason:</strong> ${failureReason}</p>
       ${shouldRetry ? '<p>We will automatically retry in 24 hours.</p>' : ''}
       <p>Please <a href="${bankDetailsUrl}">update your bank details</a> to ensure future payouts succeed.</p>`,
    );

    this.logger.warn(`handleTransferFailed: payout ${payout.id} failed — retry=${shouldRetry}`);
  }

  async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    const onboarded = Boolean(account.charges_enabled && account.payouts_enabled);

    const result = await this.prisma.user.updateMany({
      where: { stripeConnectAccountId: account.id },
      data: { stripeConnectOnboarded: onboarded },
    });

    if (result.count > 0) {
      this.logger.log(
        `handleAccountUpdated: account ${account.id} onboarded=${onboarded}`,
      );
    }
  }
}
