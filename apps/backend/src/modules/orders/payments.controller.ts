import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import type { Request } from 'express';
import Stripe from 'stripe';

import { OrdersService } from './orders.service.js';
import { PaymentsService } from './payments.service.js';

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
  ) {}

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: Request,
    @Body() payload: StripeWebhookPayload,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body ?? payload);
    const event = this.paymentsService.validateStripeEvent(payload, signature, rawBody);
    const intent = event?.data?.object as Stripe.PaymentIntent | undefined;
    const orderId = intent?.metadata?.orderId ?? payload?.data?.object?.metadata?.orderId;

    if (!orderId) {
      return { received: true };
    }

    const providerStatus = intent?.status ?? event.type ?? 'unknown';

    await this.paymentsService.updateProviderStatus(orderId, providerStatus);

    if (event.type === 'payment_intent.succeeded') {
      await this.ordersService.updateStatus(orderId, {
        status: OrderStatus.PAID,
        note: 'Stripe webhook capture',
        providerStatus,
      });
    } else if (event.type === 'payment_intent.canceled') {
      await this.ordersService.updateStatus(orderId, {
        status: OrderStatus.CANCELLED,
        note: 'Stripe webhook cancellation',
        providerStatus,
      });
    } else if (event.type === 'payment_intent.payment_failed') {
      await this.ordersService.updateStatus(orderId, {
        status: OrderStatus.REFUNDED,
        note: 'Stripe webhook failure',
        providerStatus,
      });
    }

    return { received: true };
  }
}
