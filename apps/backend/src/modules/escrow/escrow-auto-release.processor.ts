import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { EscrowStatus } from "@prisma/client";
import { EscrowService } from "./escrow.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class EscrowAutoReleaseProcessor implements OnModuleInit {
  private readonly logger = new Logger(EscrowAutoReleaseProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly escrowService: EscrowService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    this.logger.log("Starting escrow auto-release reconciliation...");
    await this.reconcileMissedReleases();
    this.logger.log("Escrow auto-release reconciliation complete");
  }

  @Cron("*/5 * * * *")
  async processAutoReleases() {
    const now = new Date();
    this.logger.log(`Processing auto-releases at ${now.toISOString()}`);

    const holdings = await this.prisma.escrowHolding.findMany({
      where: {
        status: EscrowStatus.HOLDING,
        releaseAfter: { lte: now },
      },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            buyerId: true,
            sellerId: true,
          },
        },
        disputes: {
          where: { status: "OPEN" },
          select: { id: true, status: true },
        },
      },
    });

    this.logger.log(`Found ${holdings.length} eligible escrow holdings`);

    for (const escrow of holdings) {
      try {
        await this.processSingleAutoRelease(escrow);
      } catch (error) {
        this.logger.error(
          `Failed to auto-release escrow for order ${escrow.orderId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log("Auto-release processing complete");
  }

  async reconcileMissedReleases() {
    this.logger.log("Starting reconciliation scan for missed auto-releases");
    await this.processAutoReleases();
    this.logger.log("Reconciliation scan complete");
  }

  private async processSingleAutoRelease(escrow: {
    id: string;
    orderId: string;
    amountCents: number;
    currency: string;
    releaseAfter: Date | null;
    order: { id: string; status: string; buyerId: string; sellerId: string };
    disputes: { id: string; status: string }[];
  }) {
    const { orderId, order, disputes, amountCents, currency } = escrow;

    if (!escrow.releaseAfter || escrow.releaseAfter > new Date()) {
      return;
    }

    if (order.status !== "DELIVERED" && order.status !== "FULFILLED") {
      this.logger.log(
        `Skipping order ${orderId}: status is ${order.status}, requires DELIVERED or FULFILLED`,
      );
      return;
    }

    if (disputes.length > 0) {
      this.logger.log(
        `Skipping order ${orderId}: ${disputes.length} open dispute(s)`,
      );
      return;
    }

    const escrowReleaseNote = `Automatic release after delivery confirmation (${order.status})`;
    this.logger.log(
      `Auto-releasing escrow for order ${orderId} (${amountCents} ${currency})`,
    );

    await this.escrowService.releaseEscrow(
      orderId,
      "SYSTEM_AUTO_RELEASE",
      escrowReleaseNote,
    );

    const releaseOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { seller: { select: { email: true, name: true } } },
    });

    if (releaseOrder?.seller) {
      await this.notifications.notifyEscrowReleased(
        releaseOrder.seller.email,
        releaseOrder.seller.name ?? "Seller",
        orderId,
        amountCents,
        currency,
      );
    }

    this.logger.log(
      `Auto-release complete for order ${orderId}. Audit: SYSTEM_AUTO_RELEASE`,
    );
  }
}
