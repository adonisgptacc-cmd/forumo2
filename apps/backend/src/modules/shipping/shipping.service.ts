import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
// TODO Phase 4: integrate Courier Guy and Fastway directly via their native APIs
//   for South Africa-specific last-mile carriers not covered by Shippo.

export interface ShippoAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state?: string;
  zip?: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface ShippoParcel {
  /** grams */
  weight: number;
  /** centimetres */
  length: number;
  width: number;
  height: number;
}

export interface ShippingRate {
  rateId: string;
  carrier: string;
  service: string;
  /** price in cents */
  price: number;
  currency: string;
  estimatedDays: number | null;
}

export interface PurchasedLabel {
  labelUrl: string;
  trackingNumber: string;
  carrier: string;
  estimatedDelivery: Date | null;
  shippoTransactionId: string;
}

export interface TrackingInfo {
  status: string;
  estimatedDelivery: Date | null;
  events: Array<{
    timestamp: Date;
    status: string;
    location: string | null;
    description: string;
  }>;
}

export interface AddressValidationResult {
  valid: boolean;
  corrections?: Record<string, unknown>;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private readonly client: any;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>("SHIPPO_API_KEY");
    if (apiKey) {
      // Dynamic import keeps the optional dependency from crashing startup when unset
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Shippo = require("shippo");
        this.client = new Shippo({ apiKeyHeader: apiKey });
      } catch {
        this.logger.warn(
          "shippo package not installed — run: npm install shippo",
        );
        this.client = null;
      }
    } else {
      this.logger.warn("SHIPPO_API_KEY not set — shipping features disabled");
      this.client = null;
    }
  }

  private ensureClient(): any {
    if (!this.client) {
      throw new Error(
        "Shippo is not configured. Set SHIPPO_API_KEY in the environment.",
      );
    }
    return this.client;
  }

  async getRates(
    fromAddress: ShippoAddress,
    toAddress: ShippoAddress,
    parcel: ShippoParcel,
  ): Promise<ShippingRate[]> {
    const client = this.ensureClient();

    const shipment = await client.shipments.create({
      address_from: this.toShippoAddress(fromAddress),
      address_to: this.toShippoAddress(toAddress),
      parcels: [this.toShippoParcel(parcel)],
      async: false,
    });

    const rates: any[] = shipment.rates ?? [];
    return rates.map((rate: any) => ({
      rateId: rate.object_id,
      carrier: rate.provider ?? "unknown",
      service:
        rate.servicelevel?.name ?? rate.servicelevel?.token ?? "Standard",
      price: Math.round(parseFloat(rate.amount ?? "0") * 100),
      currency: (rate.currency ?? "USD").toUpperCase(),
      estimatedDays: rate.estimated_days ?? null,
    }));
  }

  async purchaseLabel(rateId: string): Promise<PurchasedLabel> {
    const client = this.ensureClient();

    const transaction = await client.transactions.create({
      rate: rateId,
      label_file_type: "PDF",
      async: false,
    });

    if (transaction.status !== "SUCCESS") {
      const msgs: string = (transaction.messages ?? [])
        .map((m: any) => m.text ?? m.source)
        .filter(Boolean)
        .join("; ");
      throw new Error(`Label purchase failed: ${msgs || transaction.status}`);
    }

    return {
      labelUrl: transaction.label_url,
      trackingNumber: transaction.tracking_number,
      carrier: transaction.rate?.provider ?? "unknown",
      estimatedDelivery: transaction.eta ? new Date(transaction.eta) : null,
      shippoTransactionId: transaction.object_id,
    };
  }

  async getTracking(
    carrier: string,
    trackingNumber: string,
  ): Promise<TrackingInfo> {
    const client = this.ensureClient();

    const tracking = await client.trackingStatus.get(carrier, trackingNumber);

    const status: string = tracking.tracking_status?.status ?? "UNKNOWN";
    const eta: Date | null = tracking.eta ? new Date(tracking.eta) : null;

    const history: any[] = tracking.tracking_history ?? [];
    const events = history.map((evt: any) => ({
      timestamp: new Date(evt.status_date),
      status: evt.status ?? "UNKNOWN",
      location: evt.location
        ? [evt.location.city, evt.location.state, evt.location.country]
            .filter(Boolean)
            .join(", ")
        : null,
      description: evt.status_details ?? evt.status ?? "",
    }));

    return { status, estimatedDelivery: eta, events };
  }

  async validateAddress(
    address: ShippoAddress,
  ): Promise<AddressValidationResult> {
    const client = this.ensureClient();

    const result = await client.addresses.create({
      ...this.toShippoAddress(address),
      validate: true,
    });

    const validationResults = result.validation_results;
    const isValid: boolean = validationResults?.is_valid ?? false;
    const messages: any[] = validationResults?.messages ?? [];

    return {
      valid: isValid,
      corrections: messages.length ? { messages } : undefined,
    };
  }

  async createReturnLabel(
    originalTransactionId: string,
  ): Promise<PurchasedLabel> {
    const client = this.ensureClient();

    const originalTransaction = await client.transactions.get(
      originalTransactionId,
    );
    if (!originalTransaction) {
      throw new Error(
        `Transaction ${originalTransactionId} not found in Shippo`,
      );
    }

    const shipmentId =
      originalTransaction.rate?.shipment ??
      originalTransaction.rate_id_or_shipment;
    if (!shipmentId) {
      throw new Error("Cannot determine original shipment from transaction");
    }

    const originalShipment = await client.shipments.get(shipmentId);
    if (!originalShipment) {
      throw new Error("Original shipment not found in Shippo");
    }

    // Create return shipment with from/to swapped
    const returnShipment = await client.shipments.create({
      address_from: originalShipment.address_to,
      address_to: originalShipment.address_from,
      parcels: originalShipment.parcels,
      async: false,
    });

    const rates: any[] = returnShipment.rates ?? [];
    if (!rates.length) {
      throw new Error(
        "No rates available for return shipment — check address validity",
      );
    }

    // Select the cheapest rate automatically
    const cheapestRate = rates.reduce((min: any, r: any) =>
      parseFloat(r.amount) < parseFloat(min.amount) ? r : min,
    );

    return this.purchaseLabel(cheapestRate.object_id);
  }

  private toShippoAddress(
    address: ShippoAddress,
  ): Record<string, string | undefined> {
    return {
      name: address.name,
      street1: address.street1,
      street2: address.street2,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      phone: address.phone,
      email: address.email,
    };
  }

  private toShippoParcel(parcel: ShippoParcel): Record<string, string> {
    return {
      length: String(parcel.length),
      width: String(parcel.width),
      height: String(parcel.height),
      distance_unit: "cm",
      weight: String(parcel.weight),
      mass_unit: "g",
    };
  }
}
