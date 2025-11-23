import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import type { Request } from 'express';
import Stripe from 'stripe';

import { OrdersService } from './orders.service.js';
import { PaymentsService } from './payments.service.js';
import { RateLimitService } from '../../common/services/rate-limit.service.js';
import { AuditLogService } from '../observability/audit-log.service.js';

interface StripeIntentPayload {
  id: string;
  status?: string;
  metadata?: { orderId?: string };
}

interface StripeWebhookPayload {
  type?: string;
  data?: { object?: StripeIntentPayload };
}

@Controller('orders/payments')
export class PaymentsController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly rateLimit: RateLimitService,
    private readonly auditLog: AuditLogService,
    private readonly configService: ConfigService,
  ) {}

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: Request,
    @Body() payload: StripeWebhookPayload,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    this.applyRateLimit(req);
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body ?? payload);
    const eventRecord = await this.paymentsService.recordWebhookEvent(payload?.type ?? 'stripe', payload);
    const event = this.paymentsService.validateStripeEvent(payload, signature, rawBody);
    const intent = event?.data?.object as Stripe.PaymentIntent | undefined;
    const orderId = intent?.metadata?.orderId ?? payload?.data?.object?.metadata?.orderId;

    try {
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

  private applyRateLimit(req: Request) {
    const limit = Number(this.configService.get<string>('PAYMENT_RATE_LIMIT') ?? 30);
    const windowMs = Number(this.configService.get<string>('PAYMENT_RATE_WINDOW_MS') ?? 60_000);
    const key = `payments:webhook:${req.ip ?? 'unknown'}`;
    this.rateLimit.enforce(key, Number.isNaN(limit) ? 30 : limit, Number.isNaN(windowMs) ? 60_000 : windowMs);
  }
}
