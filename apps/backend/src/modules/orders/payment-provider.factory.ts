import { Injectable } from "@nestjs/common";

const PAYSTACK_CURRENCIES = new Set(["NGN", "GHS", "KES", "ZAR"]);

@Injectable()
export class PaymentProviderFactory {
  selectProvider(currency: string): "stripe" | "paystack" {
    return PAYSTACK_CURRENCIES.has(currency.toUpperCase())
      ? "paystack"
      : "stripe";
  }
}
