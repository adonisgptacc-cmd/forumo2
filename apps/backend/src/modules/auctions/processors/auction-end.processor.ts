import { randomUUID } from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuctionStatus, OrderStatus, ListingStatus } from "@prisma/client";
import { NotificationsService } from "../../notifications/notifications.service";
import { CacheService } from "../../../common/services/cache.service";
import { FeeService } from "../../fees/fee.service";

@Injectable()
export class AuctionEndProcessor {
  private readonly logger = new Logger(AuctionEndProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly cache: CacheService,
    private readonly feeService: FeeService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    this.logger.debug("Checking for ended auctions...");
    await this.processEndedAuctions();
  }

  async processEndedAuctions() {
    const now = new Date();

    // Find active auctions that have passed their end time
    const endedAuctions = await this.prisma.auction.findMany({
      where: {
        status: AuctionStatus.ACTIVE,
        endAt: { lte: now },
      },
      include: {
        bids: {
          orderBy: { amountCents: "desc" },
          take: 1,
        },
        listing: true,
      },
    });

    for (const auction of endedAuctions) {
      this.logger.log(`Processing ended auction ${auction.id}`);

      try {
        let createdOrderId: string | null = null;
        let winnerId: string | null = null;

        await this.prisma.$transaction(async (tx) => {
          // Double check status in transaction
          const current = await tx.auction.findUnique({
            where: { id: auction.id },
          });
          if (current?.status !== AuctionStatus.ACTIVE) return;

          const winningBid = auction.bids[0];

          if (!winningBid) {
            // No bids
            await tx.auction.update({
              where: { id: auction.id },
              data: { status: AuctionStatus.COMPLETED }, // Or CANCELLED/EXPIRED if distinct
            });
            await tx.listing.update({
              where: { id: auction.listingId },
              data: { status: ListingStatus.PAUSED }, // Back to paused or expired
            });
            this.logger.log(`Auction ${auction.id} ended with no bids`);
            return;
          }

          // Check reserve
          if (
            auction.reserveCents &&
            winningBid.amountCents < auction.reserveCents
          ) {
            await tx.auction.update({
              where: { id: auction.id },
              data: { status: AuctionStatus.COMPLETED },
            });
            // Reserve not met logic (notify seller, etc)
            this.logger.log(`Auction ${auction.id} ended. Reserve not met.`);
            return;
          }

          // Winner found!
          await tx.auction.update({
            where: { id: auction.id },
            data: { status: AuctionStatus.COMPLETED },
          });

          // Calculate platform fee from the fee schedule
          const { feeAmountCents: feeCents, feePercent } =
            await this.feeService.calculateFee(winningBid.amountCents, auction.listingId);

          // Create Pending Order
          const orderNumber = `ORD-${randomUUID().split("-")[0].toUpperCase()}`;

          const order = await tx.order.create({
            data: {
              orderNumber,
              buyerId: winningBid.bidderId,
              sellerId: auction.sellerId,
              status: OrderStatus.PENDING,
              totalItemCents: winningBid.amountCents,
              feeCents,
              feePercent,
              currency: auction.currency,
              items: {
                create: {
                  listingId: auction.listingId,
                  listingTitle: auction.listing.title,
                  unitPriceCents: winningBid.amountCents,
                  currency: auction.currency,
                  quantity: 1,
                },
              },
            },
          });

          await tx.listing.update({
            where: { id: auction.listingId },
            data: { status: ListingStatus.PAUSED },
          });
          this.logger.log(
            `Auction ${auction.id} won by ${winningBid.bidderId}. Order ${order.id} created.`,
          );
          createdOrderId = order.id;
          winnerId = winningBid.bidderId;
        });
        await this.cache.deleteByPrefix("listings:search:");

        // Send notifications outside the transaction
        if (createdOrderId && winnerId) {
          const [winner, seller] = await Promise.all([
            this.prisma.user.findUnique({
              where: { id: winnerId },
              select: { email: true, name: true },
            }),
            this.prisma.user.findUnique({
              where: { id: auction.sellerId },
              select: { email: true, name: true },
            }),
          ]);

          if (winner) {
            await this.notifications.notifyAuctionWon(
              winner.email,
              winner.name ?? "Winner",
              createdOrderId,
              auction.listing.title,
              auction.bids[0].amountCents,
              auction.currency,
            );
          }
          if (seller) {
            await this.notifications.notifyAuctionSold(
              seller.email,
              seller.name ?? "Seller",
              createdOrderId,
              auction.listing.title,
              auction.bids[0].amountCents,
              auction.currency,
            );
          }
        }
      } catch (error) {
        this.logger.error(`Failed to process auction ${auction.id}`, error);
      }
    }
  }
}
