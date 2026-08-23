import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { EscrowStatus, Prisma } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { sanitizeText } from "../../common/utils/sanitize";
import { metrics } from "../../telemetry/metrics";

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async createEscrowHolding(
    orderId: string,
    amountCents: number,
    currency: string = "USD",
  ) {
    // Check if escrow already exists for this order
    const existing = await this.prisma.escrowHolding.findUnique({
      where: { orderId },
    });

    if (existing) {
      throw new BadRequestException("Escrow already exists for this order");
    }

    // Create escrow holding. releaseAfter is intentionally left unset here —
    // it is only started once delivery is confirmed, via startReleaseCountdown().
    const escrow = await this.prisma.escrowHolding.create({
      data: {
        orderId,
        amountCents,
        currency,
        status: "HOLDING",
      },
    });

    return escrow;
  }

  async getEscrowByOrderId(
    orderId: string,
    actorId?: string,
    actorRole?: string,
  ) {
    if (actorId) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { buyerId: true, sellerId: true },
      });
      if (!order) {
        throw new NotFoundException("Order not found");
      }
      const isStaff = actorRole === "ADMIN" || actorRole === "MODERATOR";
      if (!isStaff && order.buyerId !== actorId && order.sellerId !== actorId) {
        throw new ForbiddenException("Not a party to this order");
      }
    }

    const escrow = await this.prisma.escrowHolding.findUnique({
      where: { orderId },
      include: {
        disputes: {
          include: {
            openedBy: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
            messages: {
              include: {
                author: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  },
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        },
        transactions: {
          include: {
            actor: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!escrow) {
      throw new NotFoundException("Escrow not found");
    }

    return escrow;
  }

  async releaseEscrow(
    orderId: string,
    actorId: string | null,
    note?: string,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const escrow = await client.escrowHolding.findUnique({
      where: { orderId },
    });

    if (!escrow) {
      throw new NotFoundException("Escrow not found");
    }

    // Atomic conditional update — prevents duplicate releases under concurrent requests
    const result = await client.escrowHolding.updateMany({
      where: { orderId, status: "HOLDING" },
      data: { status: "RELEASED", releasedAt: new Date() },
    });

    if (result.count === 0) {
      throw new BadRequestException(
        `Cannot release escrow with status: ${escrow.status}`,
      );
    }

    const updated = await client.escrowHolding.findUnique({
      where: { orderId },
    });
    if (!updated) throw new NotFoundException("Escrow not found after release");

    // Create transaction record
    await client.escrowTransaction.create({
      data: {
        escrowId: escrow.id,
        type: "RELEASE",
        amountCents: escrow.amountCents,
        currency: escrow.currency,
        actorId,
        note: note || "Funds released to seller",
      },
    });

    await client.auditLog.create({
      data: {
        actorId,
        action: "escrow.release",
        entityType: "order",
        entityId: orderId,
        payload: {
          amountCents: escrow.amountCents,
          currency: escrow.currency,
          note: note ?? null,
        },
      },
    });

    // Payout is scheduled and processed by PayoutsService's own cron chain
    // (schedulePayouts -> processPendingPayouts), not synchronously here.
    this.logger.log(
      `Escrow for order ${orderId} released; payout will be scheduled by PayoutsService.`,
    );

    const releaseOrder = await client.order.findUnique({
      where: { id: orderId },
      select: { seller: { select: { email: true, name: true } } },
    });
    if (releaseOrder?.seller) {
      // Non-blocking notification — runs after transaction commits, cannot affect escrow release
      void this.notifications
        .notifyEscrowReleased(
          releaseOrder.seller.email,
          releaseOrder.seller.name ?? "Seller",
          orderId,
          escrow.amountCents,
          escrow.currency,
        )
        .catch(() => undefined);
    }

    return updated;
  }

  /**
   * Starts the auto-release countdown once delivery is confirmed, by either
   * the Shippo carrier webhook or the buyer's self-report endpoint.
   * Idempotent: safe to call from either trigger without double-counting.
   */
  async startReleaseCountdown(orderId: string): Promise<void> {
    const escrow = await this.prisma.escrowHolding.findUnique({
      where: { orderId },
    });

    if (!escrow || escrow.status !== "HOLDING" || escrow.releaseAfter) {
      return;
    }

    const releaseDays =
      this.config.get<number>("ESCROW_AUTO_RELEASE_DAYS") ?? 5;
    const releaseAfter = new Date();
    releaseAfter.setDate(releaseAfter.getDate() + releaseDays);

    // Atomic conditional update — claims the right to start the countdown.
    // Prevents duplicate DELIVERED transitions / timeline entries when two
    // callers race for the same order (e.g. a webhook retry racing the
    // buyer's confirm-delivery endpoint). Mirrors releaseEscrow's pattern.
    const result = await this.prisma.escrowHolding.updateMany({
      where: { orderId, status: "HOLDING", releaseAfter: null },
      data: { releaseAfter },
    });

    if (result.count === 0) {
      // Lost the race — another caller already claimed and started the
      // countdown for this order. No-op.
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });

    if (order && order.status !== "DELIVERED" && order.status !== "COMPLETED") {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          timeline: {
            create: [
              {
                status: "DELIVERED",
                note: "Delivered — escrow release countdown started",
              },
            ],
          },
        },
      });
    }

    this.logger.log(
      `Escrow release countdown started for order ${orderId}: auto-releases at ${releaseAfter.toISOString()}`,
    );
  }

  async refundEscrow(
    orderId: string,
    actorId: string,
    amountCents?: number,
    note?: string,
  ) {
    const escrow = await this.prisma.escrowHolding.findUnique({
      where: { orderId },
    });

    if (!escrow) {
      throw new NotFoundException("Escrow not found");
    }

    if (escrow.status !== "HOLDING" && escrow.status !== "DISPUTED") {
      throw new BadRequestException(
        `Cannot refund escrow with status: ${escrow.status}`,
      );
    }

    const refundAmount = amountCents ?? escrow.amountCents;

    if (refundAmount > escrow.amountCents) {
      throw new BadRequestException("Refund amount exceeds escrow amount");
    }

    // Update escrow status
    const updated = await this.prisma.escrowHolding.update({
      where: { orderId },
      data: {
        status: "REFUNDED",
      },
    });

    // Create transaction record
    await this.prisma.escrowTransaction.create({
      data: {
        escrowId: escrow.id,
        type: "REFUND",
        amountCents: refundAmount,
        currency: escrow.currency,
        actorId,
        note: note || "Funds refunded to buyer",
      },
    });

    this.logger.warn(
      `[REFUND PENDING] Escrow for order ${orderId} marked refunded. ` +
        `Buyer refund of ${refundAmount} ${escrow.currency} must be triggered via payment provider. ` +
        `Integrate Stripe refund or equivalent before going live.`,
    );

    const refundOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { buyer: { select: { email: true, name: true } } },
    });
    if (refundOrder?.buyer) {
      await this.notifications.notifyEscrowRefunded(
        refundOrder.buyer.email,
        refundOrder.buyer.name ?? "Buyer",
        orderId,
        refundAmount,
        escrow.currency,
      );
    }

    return updated;
  }

  async openDispute(orderId: string, openedById: string, reason: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { buyerId: true, sellerId: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.buyerId !== openedById && order.sellerId !== openedById) {
      throw new ForbiddenException("Not a party to this order");
    }

    const escrow = await this.prisma.escrowHolding.findUnique({
      where: { orderId },
    });

    if (!escrow) {
      throw new NotFoundException("Escrow not found");
    }

    if (escrow.status !== "HOLDING") {
      throw new BadRequestException(
        "Can only dispute escrow that is holding funds",
      );
    }

    // Update escrow status
    await this.prisma.escrowHolding.update({
      where: { orderId },
      data: {
        status: "DISPUTED",
      },
    });

    // Create dispute
    const dispute = await this.prisma.escrowDispute.create({
      data: {
        escrowId: escrow.id,
        openedById,
        reason,
        status: "OPEN",
      },
      include: {
        openedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    await this.notifications.notifyDisputeOpened(orderId, dispute.id, reason);

    return dispute;
  }

  async resolveDispute(
    disputeId: string,
    actorId: string,
    resolution: string,
    action: "RELEASE" | "REFUND" | "PARTIAL_REFUND",
    refundAmountCents?: number,
  ) {
    const dispute = await this.prisma.escrowDispute.findUnique({
      where: { id: disputeId },
      include: {
        escrow: true,
      },
    });

    if (!dispute) {
      throw new NotFoundException("Dispute not found");
    }

    if (dispute.status === "RESOLVED") {
      throw new BadRequestException("Dispute already resolved");
    }

    // Update dispute
    await this.prisma.escrowDispute.update({
      where: { id: disputeId },
      data: {
        status: "RESOLVED",
        resolution,
        resolvedAt: new Date(),
      },
    });

    // Execute action
    if (action === "RELEASE") {
      // releaseEscrow()'s atomic conditional update only claims escrows
      // currently at status "HOLDING" (by design — this is what blocks a
      // buyer from releasing a disputed escrow via the normal release path).
      // A dispute resolved in the seller's favor is the one legitimate case
      // where a DISPUTED escrow must still become RELEASED, so we perform
      // the DISPUTED -> HOLDING transition atomically here, immediately
      // before delegating to the still-strict releaseEscrow(). This keeps
      // releaseEscrow()'s guard intact for every other caller (buyer path,
      // auto-release cron).
      const claimed = await this.prisma.escrowHolding.updateMany({
        where: { id: dispute.escrow.id, status: "DISPUTED" },
        data: { status: "HOLDING" },
      });
      if (claimed.count === 0) {
        throw new BadRequestException(
          `Cannot release escrow: expected status DISPUTED, race or already resolved`,
        );
      }
      await this.releaseEscrow(
        dispute.escrow.orderId,
        actorId,
        `Dispute resolved: ${resolution}`,
      );
    } else if (action === "REFUND") {
      await this.refundEscrow(
        dispute.escrow.orderId,
        actorId,
        undefined,
        `Dispute resolved: ${resolution}`,
      );
    } else if (action === "PARTIAL_REFUND" && refundAmountCents) {
      await this.refundEscrow(
        dispute.escrow.orderId,
        actorId,
        refundAmountCents,
        `Partial refund: ${resolution}`,
      );
    }

    return this.getEscrowByOrderId(dispute.escrow.orderId);
  }

  async addDisputeMessage(
    disputeId: string,
    authorId: string,
    body: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: External SDK or dynamic payload requires flexible typing, TODO: refine to specific type
    attachments?: any,
    actorRole?: string,
  ) {
    const dispute = await this.prisma.escrowDispute.findUnique({
      where: { id: disputeId },
      include: {
        escrow: {
          select: { order: { select: { buyerId: true, sellerId: true } } },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException("Dispute not found");
    }

    const order = dispute.escrow.order;
    const isStaff = actorRole === "ADMIN" || actorRole === "MODERATOR";
    if (!isStaff && order.buyerId !== authorId && order.sellerId !== authorId) {
      throw new ForbiddenException("Not a party to this dispute");
    }

    const message = await this.prisma.disputeMessage.create({
      data: {
        disputeId,
        authorId,
        body: sanitizeText(body),
        attachments: attachments || {},
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return message;
  }

  async listActiveDisputes() {
    return this.prisma.escrowDispute.findMany({
      where: {
        status: { in: ["OPEN", "UNDER_REVIEW"] },
      },
      include: {
        escrow: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                buyer: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  },
                },
                seller: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        openedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        openedAt: "asc",
      },
    });
  }

  // ─── Auto-release cron ─────────────────────────────────────────────────────

  @Cron("0 * * * *")
  async autoReleaseExpiredEscrows(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.escrowHolding.findMany({
      where: {
        status: EscrowStatus.HOLDING,
        releaseAfter: { lte: now },
        order: { status: { in: ["DELIVERED", "COMPLETED"] } },
        disputes: {
          none: { status: { in: ["OPEN", "UNDER_REVIEW", "ESCALATED"] } },
        },
      },
      select: { orderId: true, id: true },
    });

    if (!due.length) return;

    this.logger.log(
      `autoReleaseExpiredEscrows: releasing ${due.length} escrow(s)`,
    );

    for (const escrow of due) {
      try {
        await this.releaseEscrow(
          escrow.orderId,
          "system",
          "Auto-released after buyer dispute window expired",
        );

        // Keep the order state machine consistent: an auto-released
        // escrow means the order is complete. The order's release is
        // idempotent (COMPLETED is terminal).
        await this.prisma.order.updateMany({
          where: { id: escrow.orderId, status: { not: "COMPLETED" } },
          data: { status: "COMPLETED" },
        });
        await this.prisma.orderTimelineEvent.create({
          data: {
            orderId: escrow.orderId,
            status: "COMPLETED",
            note: "Escrow auto-released after dispute window expired",
            actorId: null,
          },
        });

        metrics.backgroundJobsProcessed.inc({
          job: "escrow_auto_release",
          status: "released",
        });
      } catch (err) {
        this.logger.error(
          `autoReleaseExpiredEscrows: failed for order ${escrow.orderId}`,
          err,
        );

        metrics.backgroundJobsProcessed.inc({
          job: "escrow_auto_release",
          status: "failed",
        });
      }
    }
  }
}
