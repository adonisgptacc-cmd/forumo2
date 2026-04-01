import { randomUUID } from 'crypto';

import { BadRequestException, Injectable } from '@nestjs/common';
import { Order, PaymentProvider, PaymentStatus, Prisma, WebhookEventStatus } from '@prisma/client';
import Stripe from 'stripe';

import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PaymentsService {
  private readonly stripe?: Stripe;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (apiKey) {
      this.stripe = new Stripe(apiKey);
    }
  }

  validateStripeEvent(payload: unknown, signature?: string, rawBody?: Buffer | string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const isProd = process.env.NODE_ENV === 'production';

    // In production, always require signature verification
    if (isProd && (!this.stripe || !secret)) {
      throw new BadRequestException('Stripe webhook secret not configured');
    }
    if (isProd && (!signature || !rawBody)) {
      throw new BadRequestException('Missing Stripe webhook signature');
    }

    // Dev/test: skip verification if Stripe not configured
    if (!this.stripe || !secret || !signature || !rawBody) {
      return payload as Stripe.Event;
    }

    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, secret) as Stripe.Event;
    } catch (error) {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
  }

  async mintPaymentIntent(orderId: string, amountCents: number, currency: string): Promise<Stripe.PaymentIntent> {
    if (this.stripe) {
      return this.stripe.paymentIntents.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        description: `Order ${orderId} checkout`,
        metadata: { orderId },
        payment_method_types: ['card'],
      });
    }

    return {
      id: `pi_${randomUUID()}`,
      object: 'payment_intent',
      amount: amountCents,
      currency: currency.toLowerCase(),
      status: 'requires_payment_method',
      client_secret: `cs_${randomUUID()}`,
      metadata: { orderId },
    } as unknown as Stripe.PaymentIntent;
  }

  async updateProviderStatus(orderId: string, providerStatus?: string): Promise<void> {
    if (!providerStatus) {
      return;
    }

    await this.prisma.paymentTransaction.updateMany({
      where: { orderId },
      data: { providerStatus },
    });
  }

  async markPaymentCaptured(
    tx: Prisma.TransactionClient,
    order: Order,
    providerStatus?: string,
  ): Promise<void> {
    await this.ensurePaymentTransaction(tx, order);
    await tx.paymentTransaction.updateMany({
      where: { orderId: order.id },
      data: {
        status: PaymentStatus.CAPTURED,
        providerStatus: providerStatus ?? 'succeeded',
        processedAt: new Date(),
      },
    });
  }

  async markPaymentRefunded(
    tx: Prisma.TransactionClient,
    order: Order,
    providerStatus?: string,
  ): Promise<void> {
    await this.ensurePaymentTransaction(tx, order);
    await tx.paymentTransaction.updateMany({
      where: { orderId: order.id },
      data: {
        status: PaymentStatus.REFUNDED,
        providerStatus: providerStatus ?? 'canceled',
        processedAt: new Date(),
      },
    });
  }

  /**
   * Issue a refund via Stripe for a captured PaymentIntent.
   * Looks up the most recent captured PaymentTransaction for the order to get
   * the providerRef (payment_intent ID), then calls stripe.refunds.create().
   * Safe to call even if Stripe is not configured (logs a warning and returns).
   */
  async issueStripeRefund(orderId: string, reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'): Promise<void> {
    if (!this.stripe) {
      console.warn(`[PaymentsService] Stripe not configured — skipping refund for order ${orderId}`);
      return;
    }

    const captured = await this.prisma.paymentTransaction.findFirst({
      where: {
        orderId,
        status: { in: [PaymentStatus.CAPTURED, PaymentStatus.SETTLED] },
        provider: PaymentProvider.STRIPE,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!captured?.providerRef) {
      console.warn(`[PaymentsService] No captured Stripe transaction found for order ${orderId} — skipping refund`);
      return;
    }

    try {
      await this.stripe.refunds.create({
        payment_intent: captured.providerRef,
        reason: reason ?? 'requested_by_customer',
      });
    } catch (err) {
      // Log but don't rethrow — the order cancellation should still succeed in DB
      console.error(`[PaymentsService] Stripe refund failed for order ${orderId}:`, err);
    }
  }

  async recordWebhookEvent(eventName: string, payload: unknown, status: WebhookEventStatus = WebhookEventStatus.PENDING) {
    return this.prisma.webhookEvent.create({
      data: {
        eventName,
        status,
        payload: this.toJsonInput(payload) ?? (Prisma.JsonNull as unknown as Prisma.InputJsonValue),
      },
    });
  }

  async markWebhookProcessed(id?: string) {
    if (!id) return;
    await this.prisma.webhookEvent.update({
      where: { id },
      data: { status: WebhookEventStatus.SUCCESS, lastError: null },
    });
  }

  async markWebhookFailed(id?: string, error?: unknown) {
    if (!id) return;
    await this.prisma.webhookEvent.update({
      where: { id },
      data: {
        status: WebhookEventStatus.FAILED,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }

  private async ensurePaymentTransaction(tx: Prisma.TransactionClient, order: Order): Promise<void> {
    const existing = await tx.paymentTransaction.findFirst({ where: { orderId: order.id } });
    if (existing) {
      return;
    }

    await tx.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.PENDING,
        providerStatus: 'created',
        amountCents: this.calculateOrderTotal(order),
        currency: order.currency,
        metadata: Prisma.JsonNull,
      },
    });
  }

  private calculateOrderTotal(order: Pick<Order, 'totalItemCents' | 'shippingCents' | 'feeCents'>): number {
    return order.totalItemCents + order.shippingCents + order.feeCents;
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue | null {
    if (value === null || value === undefined) {
      return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
    }
    return value as Prisma.InputJsonValue;
  }
}
