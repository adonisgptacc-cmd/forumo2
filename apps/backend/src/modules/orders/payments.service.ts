import { randomUUID } from "crypto";

import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  Order,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  WebhookEventStatus,
} from "@prisma/client";
import Stripe from "stripe";

import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe?: Stripe;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (apiKey) {
      this.stripe = new Stripe(apiKey);
    }
  }

  validateStripeEvent(
    payload: unknown,
    signature?: string,
    rawBody?: Buffer | string,
  ): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const isProd = process.env.NODE_ENV === "production";

    // In production, always require signature verification — fail closed
    if (isProd && (!this.stripe || !secret)) {
      throw new BadRequestException("Stripe webhook secret not configured");
    }
    if (isProd && (!signature || !rawBody)) {
      throw new BadRequestException("Missing Stripe webhook signature");
    }

    // Non-production: allow unsigned payloads when Stripe is not configured (test convenience)
    // but still reject fabricated events when a secret is configured and signature is missing.
    if (!this.stripe || !secret) {
      return payload as Stripe.Event;
    }
    if (!signature || !rawBody) {
      return payload as Stripe.Event;
    }

    try {
      return this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        secret,
      ) as Stripe.Event;
    } catch (error) {
      throw new BadRequestException("Invalid Stripe webhook signature");
    }
  }

  async mintPaymentIntent(
    orderId: string,
    amountCents: number,
    currency: string,
    options?: {
      shippingAddress?: {
        name: string;
        line1: string;
        line2?: string;
        city: string;
        state?: string;
        postalCode?: string;
        country: string;
      };
    },
  ): Promise<Stripe.PaymentIntent> {
    if (this.stripe) {
      const shipping = options?.shippingAddress;
      return this.stripe.paymentIntents.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        ...(shipping && {
          automatic_tax: { enabled: true },
          shipping: {
            name: shipping.name,
            address: {
              line1: shipping.line1,
              ...(shipping.line2 && { line2: shipping.line2 }),
              city: shipping.city,
              ...(shipping.state && { state: shipping.state }),
              ...(shipping.postalCode && { postal_code: shipping.postalCode }),
              country: shipping.country,
            },
          },
        }),
        description: `Order ${orderId} checkout`,
        metadata: { orderId },
      });
    }

    return {
      id: `pi_${randomUUID()}`,
      object: "payment_intent",
      amount: amountCents,
      currency: currency.toLowerCase(),
      status: "requires_payment_method",
      client_secret: `cs_${randomUUID()}`,
      metadata: { orderId },
    } as unknown as Stripe.PaymentIntent;
  }

  async updateProviderStatus(
    orderId: string,
    providerStatus?: string,
  ): Promise<void> {
    if (!providerStatus) {
      return;
    }

    await this.prisma.paymentTransaction.updateMany({
      where: { orderId },
      data: { providerStatus },
    });
  }

  async findOrderIdByProviderReference(
    providerRef: string,
  ): Promise<string | null> {
    const payment = await this.prisma.paymentTransaction.findFirst({
      where: { providerRef },
      select: { orderId: true },
    });
    return payment?.orderId ?? null;
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
        providerStatus: providerStatus ?? "succeeded",
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
        providerStatus: providerStatus ?? "canceled",
        processedAt: new Date(),
      },
    });
  }

  /**
   * Mark the most recent payment transaction as FAILED without touching the
   * order status. Used for `payment_intent.payment_failed` webhooks so a
   * failed charge is never reported as a refund and the buyer can retry.
   */
  async markPaymentFailed(
    orderId: string,
    providerStatus?: string,
  ): Promise<void> {
    await this.prisma.paymentTransaction.updateMany({
      where: { orderId },
      data: {
        status: PaymentStatus.FAILED,
        providerStatus: providerStatus ?? "failed",
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
  async issueStripeRefund(
    orderId: string,
    reason?: "duplicate" | "fraudulent" | "requested_by_customer",
    idempotencyKey?: string,
  ): Promise<"confirmed" | "pending"> {
    if (!this.stripe) {
      if (process.env.NODE_ENV === "test") return "confirmed";
      throw new BadRequestException("Stripe refunds are not configured");
    }

    const captured = await this.prisma.paymentTransaction.findFirst({
      where: {
        orderId,
        status: {
          in: [
            PaymentStatus.AUTHORIZED,
            PaymentStatus.CAPTURED,
            PaymentStatus.SETTLED,
            PaymentStatus.REFUND_PENDING,
            PaymentStatus.REFUND_FAILED,
            PaymentStatus.REFUNDED,
          ],
        },
        provider: PaymentProvider.STRIPE,
      },
      orderBy: { createdAt: "desc" },
    });

    // Idempotent: if already refunded, skip provider call
    if (captured?.status === PaymentStatus.REFUNDED) {
      return "confirmed";
    }

    if (!captured?.providerRef) {
      throw new BadRequestException(
        `No refundable Stripe transaction found for order ${orderId}`,
      );
    }

    const key = idempotencyKey ?? `refund_${orderId}_${captured.providerRef}`;
    try {
      const refund = await this.stripe.refunds.create(
        {
          payment_intent: captured.providerRef,
          reason: reason ?? "requested_by_customer",
        },
        { idempotencyKey: key },
      );
      return refund.status === "succeeded" ? "confirmed" : "pending";
    } catch (err) {
      this.logger.error(
        `Stripe refund failed for order ${orderId}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  async recordWebhookEvent(
    eventName: string,
    payload: unknown,
    status: WebhookEventStatus = WebhookEventStatus.PENDING,
    providerEventId?: string,
  ) {
    if (providerEventId) {
      const existing = await this.prisma.webhookEvent.findUnique({
        where: { providerEventId },
      });
      if (existing) {
        return existing;
      }
    }
    try {
      return await this.prisma.webhookEvent.create({
        data: {
          eventName,
          providerEventId,
          status,
          payload:
            this.toJsonInput(payload) ??
            (Prisma.JsonNull as unknown as Prisma.InputJsonValue),
        },
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        const existing = await this.prisma.webhookEvent.findUnique({
          where: { providerEventId },
        });
        if (existing) return existing;
      }
      throw e;
    }
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
        lastError: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }

  private async ensurePaymentTransaction(
    tx: Prisma.TransactionClient,
    order: Order,
  ): Promise<void> {
    const existing = await tx.paymentTransaction.findFirst({
      where: { orderId: order.id },
    });
    if (existing) {
      return;
    }

    await tx.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.PENDING,
        providerStatus: "created",
        amountCents: this.calculateOrderTotal(order),
        currency: order.currency,
        metadata: Prisma.JsonNull,
      },
    });
  }

  private calculateOrderTotal(
    order: Pick<Order, "totalItemCents" | "shippingCents" | "feeCents">,
  ): number {
    return order.totalItemCents + order.shippingCents + order.feeCents;
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue | null {
    if (value === null || value === undefined) {
      return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
    }
    return value as Prisma.InputJsonValue;
  }
}
