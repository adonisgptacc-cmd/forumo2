import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PayoutStatus, Prisma } from "@prisma/client";
import Stripe from "stripe";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PaystackService } from "../orders/paystack.service";
import { AuditLogService } from "../observability/audit-log.service";
import { metrics } from "../../telemetry/metrics";

// Stripe Connect is not available in all African markets.
// Paystack Transfers is used for ZAR/NGN/GHS/KES payouts.

const PLATFORM_FEE_RATE = 0.05; // 5% platform fee deducted from escrow at payout
const MINIMUM_PAYOUT_CENTS = 5000; // 50 ZAR / ~$5 USD
const NEW_SELLER_PAYOUT_COUNT_THRESHOLD = 3; // hold first N payouts
const NEW_SELLER_HOLD_DAYS = 14;
const ESCROW_RELEASE_HOLD_DAYS = 7;

const PAYSTACK_CURRENCIES = new Set(["ZAR", "NGN", "GHS", "KES"]);

type PayoutWithSeller = Prisma.PayoutGetPayload<{
  include: { seller: { include: { profile: true } } };
}>;

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private readonly stripe?: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly paystackService: PaystackService,
    private readonly auditLog: AuditLogService,
  ) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (apiKey) {
      this.stripe = new Stripe(apiKey);
    }
  }

  // ─── Onboarding ────────────────────────────────────────────────────────────

  async createConnectedAccount(sellerId: string): Promise<{ url: string }> {
    if (!this.stripe) {
      throw new BadRequestException("Stripe is not configured");
    }

    const seller = await this.prisma.user.findUnique({
      where: { id: sellerId },
    });
    if (!seller) throw new NotFoundException("Seller not found");

    let accountId = seller.stripeConnectAccountId;

    if (!accountId) {
      const account = await this.stripe.accounts.create(
        {
          type: "express",
          country: "ZA",
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

    const appBaseUrl =
      process.env.APP_BASE_URL ?? "http://localhost:4000/api/v1";

    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appBaseUrl}/payouts/onboard/callback?refresh=true&accountId=${accountId}`,
      return_url: `${appBaseUrl}/payouts/onboard/callback?accountId=${accountId}`,
      type: "account_onboarding",
    });

    this.logger.log(`Onboarding link created for seller ${sellerId}`);
    return { url: accountLink.url };
  }

  async refreshConnectAccountStatus(
    stripeConnectAccountId: string,
  ): Promise<string> {
    if (!this.stripe) return "stripe_not_configured";

    const account = await this.stripe.accounts.retrieve(stripeConnectAccountId);
    const onboarded = Boolean(
      account.charges_enabled && account.payouts_enabled,
    );

    await this.prisma.user.updateMany({
      where: { stripeConnectAccountId },
      data: { stripeConnectOnboarded: onboarded },
    });

    this.logger.log(
      `Connect account ${stripeConnectAccountId} onboarded=${onboarded}`,
    );
    return onboarded ? "complete" : "pending";
  }

  // ─── Balance ───────────────────────────────────────────────────────────────

  async getAvailableBalance(sellerId: string): Promise<{
    available: number;
    pending: number;
    currency: string;
  }> {
    const releasedEscrows = await this.prisma.escrowHolding.findMany({
      where: { status: "RELEASED", order: { sellerId } },
      select: { amountCents: true },
    });

    const grossEscrow = releasedEscrows.reduce(
      (sum, e) => sum + e.amountCents,
      0,
    );
    const netEscrow = Math.floor(grossEscrow * (1 - PLATFORM_FEE_RATE));

    const [paidAgg, pendingAgg] = await Promise.all([
      this.prisma.payout.aggregate({
        where: { sellerId, status: PayoutStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.payout.aggregate({
        where: {
          sellerId,
          status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] },
        },
        _sum: { amount: true },
      }),
    ]);

    const alreadyPaid = paidAgg._sum.amount ?? 0;
    const inFlight = pendingAgg._sum.amount ?? 0;

    return {
      available: Math.max(0, netEscrow - alreadyPaid - inFlight),
      pending: inFlight,
      currency: "zar",
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
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.payout.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // ─── Bank list (Paystack) ──────────────────────────────────────────────────

  async listPaystackBanks(currency: string): Promise<unknown[]> {
    return this.paystackService.listBanks(currency);
  }

  // ─── Scheduling ───────────────────────────────────────────────────────────

  @Cron("0 2 * * *")
  async schedulePayouts(): Promise<void> {
    this.logger.log("schedulePayouts: scanning for eligible seller escrows");

    const cutoff = new Date(
      Date.now() - ESCROW_RELEASE_HOLD_DAYS * 24 * 60 * 60 * 1000,
    );

    const eligible = await this.prisma.escrowHolding.findMany({
      where: {
        status: "RELEASED",
        releasedAt: { lte: cutoff },
        order: { status: { in: ["DELIVERED", "COMPLETED"] } },
        disputes: {
          none: { status: { in: ["OPEN", "UNDER_REVIEW", "ESCALATED"] } },
        },
      },
      include: {
        order: { select: { id: true, sellerId: true, currency: true } },
      },
    });

    if (!eligible.length) {
      this.logger.log("schedulePayouts: no eligible escrows found");
      return;
    }

    const orderIds = eligible.map((e) => e.orderId);
    const sellerIds = Array.from(
      new Set(eligible.map((e) => e.order.sellerId)),
    );
    const existingPayouts = await this.prisma.payout.findMany({
      where: {
        OR: [
          { orderId: { in: orderIds } },
          { orderId: null, sellerId: { in: sellerIds } },
        ],
      },
      select: { orderId: true, sellerId: true, amount: true, currency: true },
    });

    const existingOrderIds = new Set(
      existingPayouts.map((p) => p.orderId).filter(Boolean) as string[],
    );
    const legacyPayoutKeys = new Set(
      existingPayouts
        .filter((p) => !p.orderId)
        .map((p) => this.legacyPayoutKey(p.sellerId, p.amount, p.currency)),
    );

    const newPayouts: Prisma.PayoutCreateManyInput[] = [];

    for (const escrow of eligible) {
      const { sellerId, currency } = escrow.order;
      if (existingOrderIds.has(escrow.orderId)) continue;

      const netAmount = Math.floor(
        escrow.amountCents * (1 - PLATFORM_FEE_RATE),
      );
      if (
        legacyPayoutKeys.has(
          this.legacyPayoutKey(sellerId, netAmount, currency),
        )
      ) {
        this.logger.warn(
          `schedulePayouts: withholding order ${escrow.orderId}; a matching legacy payout requires reconciliation`,
        );
        metrics.backgroundJobsProcessed.inc({
          job: "payout_schedule",
          status: "skipped_legacy_conflict",
        });
        continue;
      }
      if (netAmount < MINIMUM_PAYOUT_CENTS) {
        this.logger.warn(
          `schedulePayouts: skipping seller ${sellerId} — net amount ${netAmount} below minimum`,
        );
        metrics.backgroundJobsProcessed.inc({
          job: "payout_schedule",
          status: "skipped_below_minimum",
        });
        continue;
      }

      newPayouts.push({
        sellerId,
        orderId: escrow.orderId,
        amount: netAmount,
        currency: currency.toLowerCase(),
        status: PayoutStatus.PENDING,
        scheduledAt: new Date(),
      });
      metrics.backgroundJobsProcessed.inc({
        job: "payout_schedule",
        status: "created",
      });
    }

    if (newPayouts.length) {
      try {
        await this.prisma.payout.createMany({
          data: newPayouts,
          skipDuplicates: true,
        });
        this.logger.log(
          `schedulePayouts: created ${newPayouts.length} payout record(s)`,
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: External SDK or dynamic payload requires flexible typing, TODO: refine to specific type
      } catch (e: any) {
        if (e?.code === "P2002") {
          this.logger.warn(
            `schedulePayouts: duplicate payout skipped (concurrent run)`,
          );
        } else {
          throw e;
        }
      }
    }
  }

  @Cron("0 6 * * *")
  async reconcileStuckPayouts(): Promise<void> {
    const stuck = await this.prisma.payout.findMany({
      where: {
        status: PayoutStatus.PROCESSING,
        updatedAt: { lte: new Date(Date.now() - 60 * 60 * 1000) },
      },
      select: {
        id: true,
        stripeTransferId: true,
        paystackTransferCode: true,
        updatedAt: true,
      },
    });
    if (!stuck.length) return;
    this.logger.warn(
      `reconcileStuckPayouts: found ${stuck.length} stuck PROCESSING payout(s)`,
    );
    for (const p of stuck) {
      // Check provider for final status if possible, otherwise reset to PENDING for retry
      try {
        if (p.stripeTransferId && this.stripe) {
          const tr = await this.stripe.transfers.retrieve(p.stripeTransferId);
          if (tr.reversed) {
            await this.handleTransferFailed(
              p.stripeTransferId,
              "Transfer reversed by provider",
            );
          }
        } else if (p.paystackTransferCode) {
          // Paystack transfer status check could be added here
        }
      } catch {}
      // If still PROCESSING after check, reset to PENDING for manual review after 24h
      const ageHours = (Date.now() - p.updatedAt.getTime()) / (1000 * 60 * 60);
      if (ageHours > 24) {
        await this.prisma.payout.update({
          where: { id: p.id },
          data: {
            status: PayoutStatus.PENDING,
            failureReason: "Reconciled: stuck PROCESSING >24h",
          },
        });
      }
    }
  }

  private legacyPayoutKey(
    sellerId: string,
    amount: number,
    currency: string,
  ): string {
    return `${sellerId}:${amount}:${currency.toLowerCase()}`;
  }

  // ─── Processing ───────────────────────────────────────────────────────────

  async processPayout(payoutId: string): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: { seller: { include: { profile: true } } },
    });
    if (!payout) throw new NotFoundException(`Payout ${payoutId} not found`);

    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException(
        `Payout is ${payout.status}, expected PENDING`,
      );
    }

    if (payout.amount < MINIMUM_PAYOUT_CENTS) {
      throw new BadRequestException(
        `Payout amount ${payout.amount} is below the minimum of ${MINIMUM_PAYOUT_CENTS} cents`,
      );
    }

    const holdActive = await this.enforceNewSellerHold(payout.seller.id);
    if (holdActive) {
      this.logger.warn(
        `processPayout: payout ${payoutId} held — seller ${payout.seller.id} new-seller hold active`,
      );
      throw new BadRequestException(
        "Payout is on hold for new sellers. Funds will be released after the hold period.",
      );
    }

    // Atomic conditional update — only one concurrent caller can claim this
    // payout; the loser gets a clean rejection instead of both proceeding
    // to call the payment provider.
    const claimed = await this.prisma.payout.updateMany({
      where: { id: payoutId, status: PayoutStatus.PENDING },
      data: { status: PayoutStatus.PROCESSING },
    });
    if (claimed.count === 0) {
      throw new BadRequestException(
        `Payout ${payoutId} is not PENDING (already claimed by a concurrent call)`,
      );
    }

    try {
      if (PAYSTACK_CURRENCIES.has(payout.currency.toUpperCase())) {
        await this.processPaystackPayout(payoutId, payout);
      } else {
        await this.processStripePayout(payoutId, payout);
      }
      metrics.backgroundJobsProcessed.inc({
        job: "payout_process",
        status: "succeeded",
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Transfer error";
      await this.prisma.payout.update({
        where: { id: payoutId },
        data: { status: PayoutStatus.FAILED, failureReason: reason },
      });
      this.logger.error(`processPayout: failed for ${payoutId}: ${reason}`);
      metrics.backgroundJobsProcessed.inc({
        job: "payout_process",
        status: "failed",
      });
      throw err;
    }
  }

  // ─── Admin: Retry a permanently failed payout ─────────────────────────────

  async retryFailedPayout(payoutId: string, actorId: string): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
    });
    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }
    if (payout.status !== PayoutStatus.FAILED) {
      throw new BadRequestException(
        `Payout ${payoutId} is not FAILED (currently ${payout.status})`,
      );
    }

    await this.prisma.payout.updateMany({
      where: { id: payoutId, status: PayoutStatus.FAILED },
      data: { status: PayoutStatus.PENDING, failureReason: null },
    });

    await this.auditLog.record({
      actorId,
      action: "payout.retry",
      entityType: "payout",
      entityId: payoutId,
    });

    metrics.backgroundJobsProcessed.inc({
      job: "payout_process",
      status: "retried",
    });

    this.logger.log(
      `retryFailedPayout: payout ${payoutId} reset to PENDING by ${actorId}`,
    );
  }

  // Bridges schedulePayouts() (which only creates PENDING rows) to actual money
  // movement — previously nothing ever called processPayout() automatically, so
  // payouts sat at PENDING until an admin manually processed each one by id.
  @Cron("0 4 * * *")
  async processPendingPayouts(): Promise<void> {
    const pending = await this.prisma.payout.findMany({
      where: { status: PayoutStatus.PENDING },
      select: { id: true },
    });

    if (!pending.length) {
      this.logger.log("processPendingPayouts: no pending payouts found");
      return;
    }

    let succeeded = 0;
    let failed = 0;

    for (const { id } of pending) {
      try {
        await this.processPayout(id);
        succeeded += 1;
      } catch (err) {
        failed += 1;
        const reason = err instanceof Error ? err.message : "Unknown error";
        this.logger.warn(
          `processPendingPayouts: payout ${id} failed to process: ${reason}`,
        );
      }
    }

    this.logger.log(
      `processPendingPayouts: processed ${pending.length} payout(s) — ${succeeded} succeeded, ${failed} failed`,
    );
  }

  private async processStripePayout(
    payoutId: string,
    payout: PayoutWithSeller,
  ): Promise<void> {
    if (!this.stripe) {
      throw new BadRequestException("Stripe is not configured");
    }

    const { seller } = payout;
    if (!seller.stripeConnectAccountId) {
      throw new BadRequestException(
        "Seller has not completed Stripe Connect onboarding",
      );
    }
    if (!seller.stripeConnectOnboarded) {
      throw new BadRequestException(
        "Seller Stripe Connect account is not yet active",
      );
    }

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

    this.logger.log(
      `processStripePayout: transfer ${transfer.id} created for payout ${payoutId}`,
    );
  }

  private async processPaystackPayout(
    payoutId: string,
    payout: PayoutWithSeller,
  ): Promise<void> {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      throw new BadRequestException("Paystack is not configured");
    }

    const { seller } = payout;
    const profile = seller.profile;

    if (
      !profile?.bankAccountNumber ||
      !profile?.bankCode ||
      !profile?.bankAccountName
    ) {
      throw new BadRequestException(
        "Seller bank account details are incomplete. Please update your payout settings.",
      );
    }

    // Validate South African bank account number format (9–11 digits)
    if (payout.currency.toUpperCase() === "ZAR") {
      const zarAccountPattern = /^\d{9,11}$/;
      if (
        !zarAccountPattern.test(profile.bankAccountNumber.replace(/\s/g, ""))
      ) {
        throw new BadRequestException(
          "Invalid South African bank account number. Must be 9–11 digits.",
        );
      }
      // Validate bank code: SA bank codes are 6 digits
      const zarBankCodePattern = /^\d{6}$/;
      if (!zarBankCodePattern.test(profile.bankCode.replace(/\s/g, ""))) {
        throw new BadRequestException(
          "Invalid South African bank code. Must be 6 digits (e.g. 632005 for Absa).",
        );
      }
    }

    // Use cached recipient code or create a new one
    let recipientCode = seller.paystackRecipientCode;
    if (!recipientCode) {
      recipientCode = await this.paystackService.createTransferRecipient(
        profile.bankCode,
        profile.bankAccountNumber,
        profile.bankAccountName,
        payout.currency.toUpperCase(),
      );
      await this.prisma.user.update({
        where: { id: seller.id },
        data: { paystackRecipientCode: recipientCode },
      });
    }

    // reference is idempotency key — safe to retry with same payoutId
    const reference = `payout_${payoutId}`;
    const { transferCode, status } =
      await this.paystackService.initiateTransfer(
        payout.amount,
        recipientCode,
        `Forumo payout to seller ${seller.id}`,
        reference,
      );

    await this.prisma.payout.update({
      where: { id: payoutId },
      data: { paystackTransferCode: transferCode },
    });

    this.logger.log(
      `processPaystackPayout: transfer ${transferCode} (${status}) initiated for payout ${payoutId}`,
    );
  }

  // ─── New-Seller Hold ───────────────────────────────────────────────────────

  async enforceNewSellerHold(sellerId: string): Promise<boolean> {
    const paidCount = await this.prisma.payout.count({
      where: { sellerId, status: PayoutStatus.PAID },
    });

    if (paidCount >= NEW_SELLER_PAYOUT_COUNT_THRESHOLD) {
      return false;
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

  // ─── Stripe Webhook Handlers ───────────────────────────────────────────────

  async handleTransferPaid(stripeTransferId: string): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { stripeTransferId },
      include: { seller: { select: { email: true, name: true } } },
    });
    if (!payout) {
      this.logger.warn(
        `handleTransferPaid: no payout found for transfer ${stripeTransferId}`,
      );
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

  async handleTransferFailed(
    stripeTransferId: string,
    failureReason: string,
  ): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { stripeTransferId },
      include: { seller: { select: { email: true, name: true } } },
    });
    if (!payout) {
      this.logger.warn(
        `handleTransferFailed: no payout for transfer ${stripeTransferId}`,
      );
      return;
    }

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

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    const bankDetailsUrl = `${frontendUrl}/dashboard/payouts/bank-details`;
    const amount = (payout.amount / 100).toFixed(2);

    await this.notifications.sendEmail(
      payout.seller.email,
      `Payout failed — ${payout.currency.toUpperCase()} ${amount}`,
      `<p>Hi ${payout.seller.name},</p>
       <p>Unfortunately your payout of <strong>${payout.currency.toUpperCase()} ${amount}</strong> could not be completed.</p>
       <p><strong>Reason:</strong> ${failureReason}</p>
       ${shouldRetry ? "<p>We will automatically retry in 24 hours.</p>" : ""}
       <p>Please <a href="${bankDetailsUrl}">update your bank details</a> to ensure future payouts succeed.</p>`,
    );

    this.logger.warn(
      `handleTransferFailed: payout ${payout.id} failed — retry=${shouldRetry}`,
    );
  }

  async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    const onboarded = Boolean(
      account.charges_enabled && account.payouts_enabled,
    );

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

  // ─── Paystack Webhook Handlers ────────────────────────────────────────────

  async handlePaystackTransferSuccess(transferCode: string): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { paystackTransferCode: transferCode },
      include: { seller: { select: { email: true, name: true } } },
    });
    if (!payout) {
      this.logger.warn(
        `handlePaystackTransferSuccess: no payout found for transfer ${transferCode}`,
      );
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
       <p>Transfer reference: <code>${transferCode}</code></p>`,
    );

    this.logger.log(
      `handlePaystackTransferSuccess: payout ${payout.id} marked PAID`,
    );
  }

  async handlePaystackTransferFailed(
    transferCode: string,
    failureReason: string,
  ): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { paystackTransferCode: transferCode },
      include: { seller: { select: { email: true, name: true } } },
    });
    if (!payout) {
      this.logger.warn(
        `handlePaystackTransferFailed: no payout for transfer ${transferCode}`,
      );
      return;
    }

    const shouldRetry = payout.retryCount < 1;
    const retryScheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.payout.update({
      where: { id: payout.id },
      data: shouldRetry
        ? {
            status: PayoutStatus.PENDING,
            paystackTransferCode: null,
            failureReason,
            retryCount: { increment: 1 },
            scheduledAt: retryScheduledAt,
          }
        : {
            status: PayoutStatus.FAILED,
            failureReason,
          },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    const bankDetailsUrl = `${frontendUrl}/dashboard/payouts/bank-details`;
    const amount = (payout.amount / 100).toFixed(2);

    await this.notifications.sendEmail(
      payout.seller.email,
      `Payout failed — ${payout.currency.toUpperCase()} ${amount}`,
      `<p>Hi ${payout.seller.name},</p>
       <p>Unfortunately your payout of <strong>${payout.currency.toUpperCase()} ${amount}</strong> could not be completed.</p>
       <p><strong>Reason:</strong> ${failureReason}</p>
       ${shouldRetry ? "<p>We will automatically retry in 24 hours.</p>" : ""}
       <p>Please <a href="${bankDetailsUrl}">update your bank details</a> to ensure future payouts succeed.</p>`,
    );

    this.logger.warn(
      `handlePaystackTransferFailed: payout ${payout.id} failed — retry=${shouldRetry}`,
    );
  }
}
