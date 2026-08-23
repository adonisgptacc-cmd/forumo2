import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrderStatus, ShipmentStatus } from "@prisma/client";
import type { Request } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EscrowService } from "../escrow/escrow.service";

interface ShippoTrackingLocation {
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

interface ShippoTrackingStatus {
  status?: string;
  status_details?: string;
  status_date?: string;
  location?: ShippoTrackingLocation;
}

interface ShippoWebhookPayload {
  event?: string;
  data?: {
    tracking_number?: string;
    carrier?: string;
    tracking_status?: ShippoTrackingStatus;
    tracking_history?: ShippoTrackingStatus[];
    eta?: string;
  };
}

const SHIPPO_DELIVERED_STATUS = "DELIVERED";

/** Maps Shippo tracking status strings to our ShipmentStatus enum. */
function toShipmentStatus(shippoStatus: string): ShipmentStatus {
  switch (shippoStatus.toUpperCase()) {
    case "TRANSIT":
      return ShipmentStatus.IN_TRANSIT;
    case "DELIVERED":
      return ShipmentStatus.DELIVERED;
    case "RETURNED":
      return ShipmentStatus.RETURNED;
    case "FAILURE":
      return ShipmentStatus.CANCELLED;
    default:
      return ShipmentStatus.IN_TRANSIT;
  }
}

function formatLocation(location?: ShippoTrackingLocation): string | null {
  if (!location) return null;
  return (
    [location.city, location.state, location.country]
      .filter(Boolean)
      .join(", ") || null
  );
}

@Controller("webhooks")
export class ShippoWebhookController {
  private readonly logger = new Logger(ShippoWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly escrowService: EscrowService,
  ) {}

  /**
   * POST /webhooks/shippo
   * Receives Shippo tracking_updated events. Register this URL in your
   * Shippo dashboard → Webhooks with event type "tracking_updated".
   */
  @Post("shippo")
  @HttpCode(HttpStatus.OK)
  async handleShippoWebhook(
    @Req() req: Request,
    @Body() payload: ShippoWebhookPayload,
    @Headers("x-shippo-signature") signature?: string,
  ): Promise<{ received: boolean }> {
    this.verifySignature(req, signature);

    if (payload.event !== "tracking_updated") {
      return { received: true };
    }

    const data = payload.data;
    if (!data?.tracking_number || !data.carrier) {
      return { received: true };
    }

    const {
      tracking_number: trackingNumber,
      carrier,
      tracking_status,
      tracking_history,
      eta,
    } = data;

    const currentStatus = tracking_status?.status ?? "UNKNOWN";
    const estimatedDelivery = eta ? new Date(eta) : null;

    const shipment = await this.prisma.orderShipment.findFirst({
      where: { trackingNumber },
      include: {
        order: {
          include: {
            escrow: true,
            buyer: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });

    if (!shipment) {
      this.logger.warn(
        `Shippo webhook: no shipment found for tracking ${trackingNumber} (${carrier})`,
      );
      return { received: true };
    }

    const orderId = shipment.orderId;

    // Upsert all history events from Shippo into TrackingEvent (idempotent on timestamp+orderId)
    const history: ShippoTrackingStatus[] = tracking_history ?? [];
    if (tracking_status?.status_date) {
      history.push(tracking_status);
    }

    for (const evt of history) {
      if (!evt.status_date) continue;
      const timestamp = new Date(evt.status_date);

      // Use upsert-like pattern: skip if a matching event already exists
      const existing = await this.prisma.trackingEvent.findFirst({
        where: { orderId, timestamp, status: evt.status ?? "UNKNOWN" },
        select: { id: true },
      });

      if (!existing) {
        await this.prisma.trackingEvent.create({
          data: {
            orderId,
            shipmentId: shipment.id,
            status: evt.status ?? "UNKNOWN",
            description: evt.status_details ?? evt.status ?? "",
            location: formatLocation(evt.location),
            timestamp,
          },
        });
      }
    }

    // Update shipment status
    await this.prisma.orderShipment.update({
      where: { id: shipment.id },
      data: {
        status: toShipmentStatus(currentStatus),
        ...(estimatedDelivery && { estimatedDelivery }),
        ...(currentStatus.toUpperCase() === SHIPPO_DELIVERED_STATUS && {
          deliveredAt: new Date(),
        }),
      },
    });

    this.logger.log(
      `Shippo tracking update: order=${orderId} status=${currentStatus}`,
    );

    if (currentStatus.toUpperCase() === SHIPPO_DELIVERED_STATUS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Shippo webhook payload requires flexible any for provider verification
      await this.handleDelivered(shipment.order as any, orderId);
    }

    return { received: true };
  }

  private async handleDelivered(
    order: {
      id: string;
      status: string;
      buyerId: string;
      orderNumber: string;
      buyer: { id: string; email: string; name: string } | null;
      escrow: { id: string; status: string; releaseAfter: Date | null } | null;
    },
    orderId: string,
  ): Promise<void> {
    // Advance order to DELIVERED if it isn't already
    if (
      order.status !== OrderStatus.DELIVERED &&
      order.status !== OrderStatus.COMPLETED
    ) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.DELIVERED,
          deliveredAt: new Date(),
          timeline: {
            create: [
              {
                status: OrderStatus.DELIVERED,
                note: "Delivered — confirmed by Shippo tracking webhook",
              },
            ],
          },
        },
      });
    }

    // Start the auto-release countdown now that delivery is carrier-confirmed.
    if (order.escrow) {
      await this.escrowService.startReleaseCountdown(orderId);
    }

    // Notify buyer to confirm delivery
    if (order.buyer) {
      const orderUrl = `${process.env.APP_URL ?? ""}/app/orders/${orderId}`;
      void this.notifications
        .sendEmail(
          order.buyer.email,
          `Your order has been delivered — ${order.orderNumber}`,
          `<p>Hi ${order.buyer.name},</p>` +
            `<p>Your order <strong>${order.orderNumber}</strong> has been delivered!</p>` +
            `<p>Please <a href="${orderUrl}">confirm receipt</a> to release payment to the seller. ` +
            `If you have any issues, open a dispute within 5 days.</p>`,
        )
        .catch(() => undefined);

      void this.notifications
        .createInApp(order.buyer.id, "order.delivered", {
          orderId,
          ref: order.orderNumber,
        })
        .catch(() => undefined);
    }
  }

  private verifySignature(req: Request, signature?: string): void {
    const secret = this.config.get<string>("SHIPPO_WEBHOOK_SECRET");
    if (!secret) {
      throw new UnauthorizedException(
        "Shippo webhook secret not configured — rejecting webhook",
      );
    }

    if (!signature) {
      throw new UnauthorizedException("Missing Shippo webhook signature");
    }

    const rawBody: Buffer | string =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Shippo webhook payload requires flexible any for provider verification
      (req as any).rawBody ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Shippo webhook payload requires flexible any for provider verification
      Buffer.from(JSON.stringify((req as any).body ?? {}));

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

    try {
      const sigBuffer = Buffer.from(signature);
      const expBuffer = Buffer.from(expected);
      if (
        sigBuffer.length !== expBuffer.length ||
        !timingSafeEqual(sigBuffer, expBuffer)
      ) {
        throw new UnauthorizedException("Invalid Shippo webhook signature");
      }
    } catch {
      throw new UnauthorizedException("Invalid Shippo webhook signature");
    }
  }
}
