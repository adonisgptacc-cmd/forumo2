/*
 * STRIPE TAX SETUP (one-time, in Stripe Dashboard):
 * 1. Go to Stripe Dashboard → Tax → Settings → enable "Automatic tax"
 * 2. Add your business address and tax registration number under Tax Settings
 * 3. Set product tax codes in your Stripe product catalog, or accept the
 *    default (txcd_99999999 = general tangible goods).
 *
 * South Africa VAT specifics:
 * – Rate is 15% (exclusive — added on top of the price)
 * – Pass country: "ZA" and currency: "zar" for ZAR orders
 * – Stripe Tax will apply ZA VAT automatically once your business is
 *   registered with SARS and the registration number is entered in Tax Settings
 *
 * FALLBACK: If Stripe is not configured or tax calculation fails, `estimateTax`
 * returns { available: false }.  The frontend should display
 * "Tax calculated at checkout" and handle manually in that case.
 */

import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";

import { PrismaService } from "../../prisma/prisma.service";

export interface TaxShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string; // ISO 3166-1 alpha-2, e.g. "ZA", "US", "GB"
}

export interface CartLineItem {
  amountCents: number;
  reference?: string; // listing/product ID for traceability
  taxCode?: string; // Stripe tax code; default txcd_99999999 (general goods)
}

export interface TaxBreakdownEntry {
  description: string;
  amountCents: number;
  rate: number;
  inclusive: boolean;
  country: string | null;
  taxType: string | null;
}

export interface TaxEstimateResult {
  taxAmountCents: number;
  taxRate: number; // decimal e.g. 0.15 for 15%
  taxJurisdiction: string;
  breakdown: TaxBreakdownEntry[];
  available: boolean; // false → Stripe Tax not active for this region
}

export interface TaxReceiptResult {
  orderId: string;
  orderNumber: string;
  currency: string;
  subtotalCents: number;
  taxAmountCents: number;
  taxRate: number | null;
  taxJurisdiction: string | null;
  totalCents: number;
  breakdown: unknown[];
}

@Injectable()
export class TaxService {
  private readonly stripe?: Stripe;
  private readonly logger = new Logger(TaxService.name);

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (apiKey) {
      this.stripe = new Stripe(apiKey);
    }
  }

  /**
   * Estimate tax for a cart before payment is initiated.
   * Uses the Stripe Tax Calculations API — no PaymentIntent is created and no
   * funds are touched. Returns { available: false } when Stripe Tax is not
   * enabled or cannot determine tax for the buyer's region (show fallback copy).
   *
   * For ZA orders (country="ZA") Stripe applies 15% VAT automatically once
   * the business VAT registration number is configured in Stripe Tax Settings.
   */
  async estimateTax(
    cartItems: CartLineItem[],
    shippingAddress: TaxShippingAddress,
    currency: string,
  ): Promise<TaxEstimateResult> {
    if (!this.stripe) {
      return this.unavailableFallback();
    }

    try {
      const calculation = await this.stripe.tax.calculations.create(
        {
          currency: currency.toLowerCase(),
          line_items: cartItems.map((item, idx) => ({
            amount: item.amountCents,
            reference: item.reference ?? `item-${idx}`,
            tax_code: item.taxCode ?? "txcd_99999999",
          })),
          customer_details: {
            address: {
              line1: shippingAddress.line1,
              ...(shippingAddress.line2 && { line2: shippingAddress.line2 }),
              city: shippingAddress.city,
              ...(shippingAddress.state && { state: shippingAddress.state }),
              ...(shippingAddress.postalCode && {
                postal_code: shippingAddress.postalCode,
              }),
              country: shippingAddress.country,
            },
            address_source: "shipping",
          },
        },
        { expand: ["line_items"] } as Stripe.RequestOptions,
      );

      const taxExclusive = calculation.tax_amount_exclusive ?? 0;
      if (taxExclusive === 0 && calculation.tax_amount_inclusive === 0) {
        return this.unavailableFallback();
      }

      const taxAmountCents = taxExclusive + calculation.tax_amount_inclusive;
      const subtotalCents = cartItems.reduce((s, i) => s + i.amountCents, 0);
      const taxRate = subtotalCents > 0 ? taxAmountCents / subtotalCents : 0;
      const jurisdiction = this.resolveJurisdiction(
        shippingAddress.country,
        calculation,
      );

      const breakdown: TaxBreakdownEntry[] = (
        calculation.tax_breakdown ?? []
      ).map((entry) => ({
        description: this.describeTaxEntry(entry),
        amountCents: entry.amount,
        rate: entry.tax_rate_details?.percentage_decimal
          ? parseFloat(entry.tax_rate_details.percentage_decimal) / 100
          : 0,
        inclusive: entry.inclusive,
        country: entry.tax_rate_details?.country ?? null,
        taxType: entry.tax_rate_details?.tax_type ?? null,
      }));

      return {
        taxAmountCents,
        taxRate: Math.round(taxRate * 10000) / 10000,
        taxJurisdiction: jurisdiction,
        breakdown,
        available: true,
      };
    } catch (err) {
      this.logger.warn(
        `Stripe Tax estimation failed: ${(err as Error).message}`,
      );
      return this.unavailableFallback();
    }
  }

  /**
   * After a Stripe PaymentIntent succeeds, retrieve the `automatic_tax` details
   * and persist them on the Order record.  Non-fatal — a failure here must never
   * block the order paid transition.
   */
  async recordTaxTransaction(orderId: string): Promise<void> {
    if (!this.stripe) return;

    try {
      const txn = await this.prisma.paymentTransaction.findFirst({
        where: { orderId, providerRef: { not: null } },
        orderBy: { createdAt: "desc" },
      });

      if (!txn?.providerRef) return;

      const pi = await this.stripe.paymentIntents.retrieve(txn.providerRef);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Stripe SDK types missing field, requires any for provider-specific payload
      const autoTax = (pi as any).automatic_tax as
        { enabled?: boolean; status?: string } | undefined;
      if (!autoTax?.enabled || autoTax.status !== "complete") return;

      // tax_amounts lives on the latest charge (expand required in some API versions)
      const latestCharge = pi.latest_charge as Stripe.Charge | null;
      const taxAmounts: Array<{
        amount: number;
        inclusive: boolean;
        tax_rate: {
          percentage: number;
          country: string | null;
          tax_type: string | null;
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Stripe SDK types missing field, requires any for provider-specific payload
      }> = (latestCharge as any)?.tax_amounts ?? [];

      if (!taxAmounts.length) return;

      const totalTaxCents = taxAmounts.reduce((s, t) => s + t.amount, 0);
      const first = taxAmounts[0];
      const taxRate =
        first?.tax_rate?.percentage != null
          ? first.tax_rate.percentage / 100
          : null;
      const country = first?.tax_rate?.country ?? null;
      const taxType = first?.tax_rate?.tax_type ?? null;
      const jurisdiction = country
        ? `${country}${taxType ? ` (${taxType.toUpperCase()})` : ""}`
        : null;

      const breakdown = taxAmounts.map((t) => ({
        amountCents: t.amount,
        inclusive: t.inclusive,
        rate:
          t.tax_rate?.percentage != null ? t.tax_rate.percentage / 100 : null,
        country: t.tax_rate?.country ?? null,
        taxType: t.tax_rate?.tax_type ?? null,
      }));

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          taxAmountCents: totalTaxCents,
          taxRate: taxRate !== null ? new Prisma.Decimal(taxRate) : null,
          taxJurisdiction: jurisdiction,
          taxBreakdown: breakdown as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record tax for order ${orderId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Return structured tax line items for order receipt display.
   * Returns null if the order does not exist.
   */
  async generateTaxReceipt(orderId: string): Promise<TaxReceiptResult | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        taxAmountCents: true,
        taxRate: true,
        taxJurisdiction: true,
        taxBreakdown: true,
        currency: true,
        totalItemCents: true,
        shippingCents: true,
        feeCents: true,
      },
    });

    if (!order) return null;

    const subtotalCents =
      order.totalItemCents + order.shippingCents + order.feeCents;
    const breakdown = Array.isArray(order.taxBreakdown)
      ? order.taxBreakdown
      : [];

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      currency: order.currency,
      subtotalCents,
      taxAmountCents: order.taxAmountCents,
      taxRate: order.taxRate ? Number(order.taxRate) : null,
      taxJurisdiction: order.taxJurisdiction,
      totalCents: subtotalCents + order.taxAmountCents,
      breakdown,
    };
  }

  private unavailableFallback(): TaxEstimateResult {
    return {
      taxAmountCents: 0,
      taxRate: 0,
      taxJurisdiction: "",
      breakdown: [],
      available: false,
    };
  }

  private resolveJurisdiction(
    country: string,
    calc: Stripe.Tax.Calculation,
  ): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Stripe SDK types missing field, requires any for provider-specific payload
    const firstEntry = calc.tax_breakdown?.[0] as any;
    if (firstEntry?.jurisdiction?.display_name) {
      return firstEntry.jurisdiction.display_name as string;
    }
    const names: Record<string, string> = {
      ZA: "South Africa VAT",
      US: "United States Sales Tax",
      GB: "United Kingdom VAT",
      AU: "Australia GST",
      CA: "Canada GST/HST",
      DE: "Germany VAT",
      FR: "France VAT",
    };
    return names[country] ?? `${country} Tax`;
  }

  private describeTaxEntry(entry: Stripe.Tax.Calculation.TaxBreakdown): string {
    const pct = entry.tax_rate_details?.percentage_decimal ?? "0";
    const type = (entry.tax_rate_details?.tax_type ?? "tax").toUpperCase();
    const country = entry.tax_rate_details?.country ?? "";
    return `${country} ${type} ${parseFloat(pct)}%`.trim();
  }
}
