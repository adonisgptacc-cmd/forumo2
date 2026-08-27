import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { createHash } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ConfigService } from "@nestjs/config";
import { CacheService } from "../../common/services/cache.service";
import { OrderStatus } from "@prisma/client";
import { OrdersService } from "../orders/orders.service";

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly ordersService: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async processExpiredDeletions(): Promise<void> {
    const expired = await this.prisma.user.findMany({
      where: {
        deletionScheduledAt: { lte: new Date() },
        deletedAt: null,
      },
      select: { id: true },
    });

    for (const { id } of expired) {
      try {
        await this.executeAccountDeletion(id);
      } catch (err) {
        this.logger.error(
          `Failed to delete account ${id}: ${(err as Error).message}`,
        );
      }
    }
  }

  async executeAccountDeletion(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) return;

    this.logger.log(`Executing account deletion for user ${userId}`);

    const anonymisedEmail =
      createHash("sha256")
        .update(user.email ?? user.phone ?? user.id)
        .digest("hex") + "@deleted.forumo.app";
    const adminEmail = this.config.get<string>("ADMIN_NOTIFICATION_EMAIL");

    // Check for pending payouts that need admin attention
    const pendingPayout = await this.prisma.payout.findFirst({
      where: { sellerId: userId, status: "PENDING" },
    });

    if (pendingPayout) {
      this.logger.warn(
        `User ${userId} has pending payout ${pendingPayout.id} — freezing and notifying admin`,
      );
      if (adminEmail) {
        await this.notifications.sendEmail(
          adminEmail,
          `Pending payout for deleted account — Action required`,
          `<p>User account ${userId} (${user.email}) has been deleted but has a pending payout of ${pendingPayout.amount} ${pendingPayout.currency} (ID: ${pendingPayout.id}).</p><p>Please review and process manually.</p>`,
        );
      }
    }

    // Cancel active listings
    await this.prisma.listing.updateMany({
      where: { sellerId: userId, status: { in: ["PUBLISHED", "PAUSED"] } },
      data: { status: "PAUSED" },
    });
    await this.cache.deleteByPrefix("listings:search:");

    // Cancel pending/confirmed orders — route through refund path for escrow HOLDING
    const ordersToCancel = await this.prisma.order.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.PAID,
            OrderStatus.REFUND_PENDING,
            OrderStatus.REFUND_FAILED,
          ],
        },
      },
      select: { id: true },
    });
    for (const { id: orderId } of ordersToCancel) {
      const order = await this.ordersService.requestRefund(orderId, {
        status: OrderStatus.CANCELLED,
        note: "Order cancelled before account deletion",
      });
      if (
        order.status !== OrderStatus.CANCELLED &&
        order.status !== OrderStatus.REFUNDED
      ) {
        throw new Error(
          `Account deletion paused until refund for order ${orderId} is confirmed`,
        );
      }
    }

    // Soft-delete and anonymise PII — financial records remain intact (anonymised) for 7 years
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        deletionScheduledAt: null,
        accountStatus: "DELETED",
        name: "Deleted User",
        email: anonymisedEmail,
        phone: null,
        avatarUrl: null,
        passwordHash: "",
        tokenVersion: { increment: 1 }, // invalidate all existing sessions
      },
    });

    // Anonymise profile if it exists
    await this.prisma.userProfile.updateMany({
      where: { userId },
      data: { bio: null, location: null },
    });

    // Send confirmation to original email before anonymising
    if (user.email) {
      try {
        await this.notifications.sendEmail(
          user.email,
          "Your Forumo account has been deleted",
          `<p>Hi ${user.name ?? "there"},</p><p>Your Forumo account has been permanently deleted as requested.</p><p>Your personal information has been removed from our systems. Financial records have been anonymised and retained for 7 years as required by law.</p><p>We're sorry to see you go. If you ever wish to return, you're welcome to create a new account at any time.</p>`,
        );
      } catch {
        // email already anonymised, ignore send failures
      }
    }

    this.logger.log(`Account deletion completed for user ${userId}`);
  }
}
