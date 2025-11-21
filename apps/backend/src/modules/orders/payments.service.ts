import { randomUUID } from 'crypto';

import { BadRequestException, Injectable } from '@nestjs/common';
import { Order, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import Stripe from 'stripe';

import { PrismaService } from '../../prisma/prisma.service.js';

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
    if (this.stripe && secret && signature && rawBody) {
      try {
        return this.stripe.webhooks.constructEvent(rawBody, signature, secret) as Stripe.Event;
      } catch (error) {
        throw new BadRequestException('Invalid Stripe webhook signature');
      }
    }

    return payload as Stripe.Event;
  }

  async mintPaymentIntent(orderId: string, amountCents: number, currency: string): Promise<Stripe.PaymentIntent> {
    if (this.stripe) {
      return this.stripe.paymentIntents.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata: { orderId },
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
}
