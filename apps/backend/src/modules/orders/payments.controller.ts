import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import type { Request } from 'express';
import Stripe from 'stripe';

import { OrdersService } from "./orders.service";
import { PaymentsService } from "./payments.service";
import { PaystackService } from "./paystack.service";
import { RateLimitService } from "../../common/services/rate-limit.service";
import { AuditLogService } from "../observability/audit-log.service";
import { PayoutsService } from "../payouts/payouts.service";

interface StripeIntentPayload {
  id: string;
  status?: string;
  metadata?: { orderId?: string };
}

interface StripeWebhookPayload {
  type?: string;
  data?: { object?: StripeIntentPayload };
}

interface PaystackWebhookPayload {
  event?: string;
  data?: {
    reference?: string;
    transfer_code?: string;
    id?: number;
    status?: string;
    metadata?: Record<string, unknown>;
  };
}

@Controller('orders/payments')
export class PaymentsController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly paystackService: PaystackService,
    private readonly rateLimit: RateLimitService,
    private readonly auditLog: AuditLogService,
    private readonly configService: ConfigService,
    private readonly payoutsService: PayoutsService,
  ) {}

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: Request,
    @Body() payload: StripeWebhookPayload,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    this.applyRateLimit(req);
    // rawBody is a Buffer attached by NestJS when `rawBody: true` is set in NestFactory.create()
    const rawBody: Buffer | string = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body ?? payload));
    const eventRecord = await this.paymentsService.recordWebhookEvent(payload?.type ?? 'stripe', payload);
    const event = this.paymentsService.validateStripeEvent(payload, signature, rawBody);
    const intent = event?.data?.object as Stripe.PaymentIntent | undefined;
    const orderId = intent?.metadata?.orderId ?? payload?.data?.object?.metadata?.orderId;

    try {
      // ── Stripe Connect events (transfer / account) — no orderId needed ──
      if (event.type === 'transfer.paid') {
        const transfer = event.data.object as Stripe.Transfer;
        await this.payoutsService.handleTransferPaid(transfer.id);
        await this.paymentsService.markWebhookProcessed(eventRecord?.id);
        return { received: true };
      }

      if (event.type === 'transfer.failed') {
        const transfer = event.data.object as Stripe.Transfer;
        const reason = (transfer as unknown as { failure_message?: string }).failure_message
          ?? 'Transfer failed';
        await this.payoutsService.handleTransferFailed(transfer.id, reason);
        await this.paymentsService.markWebhookProcessed(eventRecord?.id);
        return { received: true };
      }

      if (event.type === 'account.updated') {
        const account = event.data.object as Stripe.Account;
        await this.payoutsService.handleAccountUpdated(account);
        await this.paymentsService.markWebhookProcessed(eventRecord?.id);
        return { received: true };
      }

      // ── Payment-intent events — require orderId ──
      if (!orderId) {
        await this.paymentsService.markWebhookProcessed(eventRecord?.id);
        return { received: true };
      }

      const providerStatus = intent?.status ?? event.type ?? 'unknown';

      await this.auditLog.record({
        action: 'payments.webhook.received',
        actorId: null,
        entityType: 'order',
        entityId: orderId,
        payload: { providerStatus, event: event.type },
        ipAddress: req.ip ?? null,
        userAgent: req.headers?.['user-agent'] ?? null,
      });

      if (event.type === 'payment_intent.succeeded') {
        await this.ordersService.updateStatusFromProvider(orderId, {
          status: OrderStatus.PAID,
          note: 'Stripe webhook capture',
          providerStatus,
        });
      } else if (event.type === 'payment_intent.canceled') {
        await this.ordersService.updateStatusFromProvider(orderId, {
          status: OrderStatus.CANCELLED,
          note: 'Stripe webhook cancellation',
          providerStatus,
        });
      } else if (event.type === 'payment_intent.payment_failed' || event.type === 'charge.refunded') {
        await this.ordersService.updateStatusFromProvider(orderId, {
          status: OrderStatus.REFUNDED,
          note: 'Stripe webhook failure',
          providerStatus,
        });
      } else if (event.type === 'charge.succeeded') {
        await this.ordersService.updateStatusFromProvider(orderId, {
          status: OrderStatus.PAID,
          note: 'Stripe charge succeeded',
          providerStatus,
        });
      } else {
        await this.paymentsService.updateProviderStatus(orderId, providerStatus);
      }

      await this.paymentsService.markWebhookProcessed(eventRecord?.id);
      return { received: true };
    } catch (error) {
      await this.paymentsService.markWebhookFailed(eventRecord?.id, error);
      throw error;
    }
  }

  @Post('paystack/verify')
  @HttpCode(HttpStatus.OK)
  async verifyPaystackPayment(
    @Body() body: { reference: string },
    @Req() req: Request,
  ): Promise<{ verified: boolean; orderId: string; amount: number; reference: string; currency: string }> {
    this.applyRateLimit(req);
    if (!body.reference) throw new BadRequestException('reference is required');
    return this.ordersService.verifyPaystackPayment(body.reference);
  }

  @Post('paystack/webhook')
  @HttpCode(HttpStatus.OK)
  async handlePaystackWebhook(
    @Req() req: Request,
    @Body() payload: PaystackWebhookPayload,
    @Headers('x-paystack-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    this.applyRateLimit(req);
    const rawBody: Buffer | string = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body ?? payload));

    // Always require the signature header when PAYSTACK_WEBHOOK_SECRET is configured.
    // Return 401 (not 400) so the caller knows this is an auth failure, not a bad request.
    const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
    if (webhookSecret && !signature) {
      throw new UnauthorizedException('Missing x-paystack-signature header');
    }
    if (signature && !this.paystackService.validateWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }

    const eventRecord = await this.paymentsService.recordWebhookEvent(payload?.event ?? 'paystack', payload);

    try {
      const event = payload.event ?? '';
      const data = payload.data ?? {};

      await this.auditLog.record({
        action: 'payments.paystack.webhook.received',
        actorId: null,
        entityType: 'paystack_event',
        entityId: data.reference ?? String(data.id ?? ''),
        payload: { event, reference: data.reference },
        ipAddress: req.ip ?? null,
        userAgent: req.headers?.['user-agent'] ?? null,
      });

      if (event === 'charge.success' && data.reference) {
        await this.ordersService.verifyPaystackPayment(data.reference);
      } else if (event === 'transfer.success' && data.transfer_code) {
        // Paystack seller payout completed — find payout by transferCode and mark settled
        await this.paymentsService.updateProviderStatus(data.transfer_code, 'transfer.success');
      } else if (event === 'refund.processed' && data.reference) {
        await this.paymentsService.updateProviderStatus(data.reference, 'refund.processed');
      }

      await this.paymentsService.markWebhookProcessed(eventRecord?.id);
      return { received: true };
    } catch (error) {
      await this.paymentsService.markWebhookFailed(eventRecord?.id, error);
      throw error;
    }
  }

  private applyRateLimit(req: Request) {
    const limit = Number(this.configService.get<string>('PAYMENT_RATE_LIMIT') ?? 30);
    const windowMs = Number(this.configService.get<string>('PAYMENT_RATE_WINDOW_MS') ?? 60_000);
    const key = `payments:webhook:${req.ip ?? 'unknown'}`;
    this.rateLimit.enforce(key, Number.isNaN(limit) ? 30 : limit, Number.isNaN(windowMs) ? 60_000 : windowMs);
  }
}
