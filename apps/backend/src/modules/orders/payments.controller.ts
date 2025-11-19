import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

import { OrdersService } from './orders.service.js';

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
  constructor(private readonly ordersService: OrdersService) {}

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(@Body() payload: StripeWebhookPayload): Promise<{ received: boolean }> {
    const intent = payload?.data?.object;
    const orderId = intent?.metadata?.orderId;

    if (!orderId) {
      return { received: true };
    }

    const providerStatus = intent.status ?? payload.type ?? 'unknown';

    if (payload.type === 'payment_intent.succeeded') {
      await this.ordersService.updateStatus(orderId, {
        status: OrderStatus.PAID,
        note: 'Stripe webhook capture',
        providerStatus,
      });
    } else if (payload.type === 'payment_intent.canceled') {
      await this.ordersService.updateStatus(orderId, {
        status: OrderStatus.CANCELLED,
        note: 'Stripe webhook cancellation',
        providerStatus,
      });
    } else if (payload.type === 'payment_intent.payment_failed') {
      await this.ordersService.updateStatus(orderId, {
        status: OrderStatus.REFUNDED,
        note: 'Stripe webhook failure',
        providerStatus,
      });
    }

    return { received: true };
  }
}
