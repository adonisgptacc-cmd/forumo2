import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import type { Request } from 'express';
import Stripe from 'stripe';
import { Throttle } from '@nestjs/throttler';

import { OrdersService } from "./orders.service";
import { PaymentsService } from "./payments.service";
import { PaystackService } from "./paystack.service";
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
    reason?: string;
    metadata?: Record<string, unknown>;
  };
}

@Controller('orders/payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly paystackService: PaystackService,
    private readonly auditLog: AuditLogService,
    private readonly configService: ConfigService,
    private readonly payoutsService: PayoutsService,
  ) {}

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  @Throttle({ payments: {} })
  async handleStripeWebhook(
    @Req() req: Request,
    @Body() payload: StripeWebhookPayload,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    // rawBody is a Buffer attached by NestJS when `rawBody: true` is set in NestFactory.create()
    const rawBody: Buffer | string = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body ?? payload));
    const eventRecord = await this.paymentsService.recordWebhookEvent(payload?.type ?? 'stripe', payload);
    const event = this.paymentsService.validateStripeEvent(payload, signature, rawBody);
    const intent = event?.data?.object as Stripe.PaymentIntent | undefined;
    const orderId = intent?.metadata?.orderId ?? payload?.data?.object?.metadata?.orderId;

    try {
      // ── Stripe Connect events (transfer / account) — no orderId needed ──
      if ((event.type as string) === 'transfer.paid') {
        const transfer = (event as any).data.object as Stripe.Transfer;
        await this.payoutsService.handleTransferPaid(transfer.id);
        await this.paymentsService.markWebhookProcessed(eventRecord?.id);
        return { received: true };
      }

      if ((event.type as string) === 'transfer.failed') {
        const transfer = (event as any).data.object as Stripe.Transfer;
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
  @Throttle({ payments: {} })
  async verifyPaystackPayment(
    @Body() body: { reference: string },
    @Req() req: Request,
  ): Promise<{ verified: boolean; orderId: string; amount: number; reference: string; currency: string }> {
    if (!body.reference) throw new BadRequestException('reference is required');
    return this.ordersService.verifyPaystackPayment(body.reference);
  }

  @Post('paystack/webhook')
  @HttpCode(HttpStatus.OK)
  @Throttle({ payments: {} })
  async handlePaystackWebhook(
    @Req() req: Request,
    @Body() payload: PaystackWebhookPayload,
    @Headers('x-paystack-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    const rawBody: Buffer | string = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body ?? payload));
    const ip = req.ip ?? 'unknown';
    const ts = new Date().toISOString();

    // Always require the signature header — return 401 so the caller knows this is
    // an auth failure, not a malformed request.
    if (!signature) {
      this.logger.warn(`[Paystack] Missing x-paystack-signature header — IP: ${ip}, time: ${ts}`);
      throw new UnauthorizedException('Missing x-paystack-signature header');
    }
    if (!this.paystackService.validateWebhookSignature(rawBody, signature)) {
      this.logger.warn(`[Paystack] Invalid webhook signature — IP: ${ip}, time: ${ts}`);
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
        await this.payoutsService.handlePaystackTransferSuccess(data.transfer_code);
      } else if (event === 'transfer.failed' && data.transfer_code) {
        const reason = data.reason ?? 'Transfer failed';
        await this.payoutsService.handlePaystackTransferFailed(data.transfer_code, reason);
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

}
