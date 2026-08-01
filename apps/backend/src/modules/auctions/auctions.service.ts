import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateAuctionDto } from "./dto/create-auction.dto";
import { PlaceBidDto } from "./dto/place-bid.dto";
import { AuctionStatus, ListingStatus, ListingType } from "@prisma/client";
import { AuctionsGateway } from "./auctions.gateway";
import { CacheService } from "../../common/services/cache.service";

@Injectable()
export class AuctionsService {
  private readonly logger = new Logger(AuctionsService.name);

  constructor(
    private prisma: PrismaService,
    private auctionsGateway: AuctionsGateway,
    private readonly cache: CacheService,
  ) {}

  async findAll(params: {
    status?: string;
    page: number;
    pageSize: number;
    sort?: string;
    keyword?: string;
    sellerId?: string;
  }) {
    const { status, page, pageSize, sort, keyword, sellerId } = params;
    const where: any = {};
    if (status) {
      where.status = status;
    } else {
      where.status = AuctionStatus.ACTIVE;
    }
    if (sellerId) {
      where.sellerId = sellerId;
    }

    if (keyword?.trim()) {
      where.listing = {
        OR: [
          { title: { contains: keyword.trim(), mode: "insensitive" } },
          { description: { contains: keyword.trim(), mode: "insensitive" } },
        ],
      };
    }

    const orderBy: any =
      sort === "newest"
        ? { createdAt: "desc" }
        : sort === "priceAsc"
          ? { startingBidCents: "asc" }
          : sort === "priceDesc"
            ? { startingBidCents: "desc" }
            : { endAt: "asc" }; // default: ending soonest first

    const [data, total] = await Promise.all([
      this.prisma.auction.findMany({
        where,
        include: {
          listing: { include: { images: true } },
          seller: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { bids: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auction.count({ where }),
    ]);

    return {
      data: data.map((auction) => ({
        ...auction,
        bidCount: auction._count.bids,
        _count: undefined,
      })),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async create(userId: string, dto: CreateAuctionDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
    });

    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.sellerId !== userId)
      throw new ForbiddenException("Not owner of listing");
    if (listing.status === ListingStatus.PUBLISHED)
      throw new BadRequestException("Listing already published");

    const endAt = new Date();
    endAt.setDate(endAt.getDate() + dto.durationDays);

    return this.prisma.$transaction(async (tx) => {
      const auction = await tx.auction.create({
        data: {
          listingId: dto.listingId,
          sellerId: userId,
          startingBidCents: dto.startingBidCents,
          reserveCents: dto.reserveCents,
          buyNowCents: dto.buyNowCents,
          startAt: new Date(),
          endAt: endAt,
          status: AuctionStatus.ACTIVE,
        },
      });

      await tx.listing.update({
        where: { id: dto.listingId },
        data: {
          type: ListingType.AUCTION,
          status: ListingStatus.PUBLISHED,
          priceCents: dto.startingBidCents,
        },
      });
      await this.cache.deleteByPrefix("listings:search:");

      this.logger.log(`Auction created for listing ${dto.listingId}`);
      return auction;
    });
  }

  async findOne(id: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: {
        listing: { include: { images: true } },
        bids: {
          orderBy: { amountCents: "desc" },
          take: 10,
          include: {
            bidder: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        seller: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    if (!auction) throw new NotFoundException("Auction not found");
    return auction;
  }

  async placeBid(userId: string, auctionId: string, dto: PlaceBidDto) {
    const createdBid = await this.prisma.$transaction(async (tx) => {
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
      });

      if (!auction) throw new NotFoundException("Auction not found");
      if (auction.sellerId === userId)
        throw new ForbiddenException("Cannot bid on own auction");
      if (auction.status !== AuctionStatus.ACTIVE)
        throw new BadRequestException("Auction not active");
      if (new Date() > auction.endAt)
        throw new BadRequestException("Auction ended");

      const highestBid = await tx.bid.findFirst({
        where: { auctionId },
        orderBy: { amountCents: "desc" },
      });

      const currentDisplayPrice = highestBid
        ? highestBid.amountCents
        : auction.startingBidCents;
      const minIncrement = this.getMinIncrement(currentDisplayPrice);
      const minBidRequired = highestBid
        ? currentDisplayPrice + minIncrement
        : auction.startingBidCents;

      // The user's maximum bid
      const newMaxBid = dto.maxAutoBidCents || dto.amountCents;

      if (newMaxBid < minBidRequired) {
        throw new BadRequestException(
          `Bid must be at least ${(minBidRequired / 100).toFixed(2)}`,
        );
      }

      // Anti-sniping
      const timeRemaining = auction.endAt.getTime() - Date.now();
      if (timeRemaining < 120000) {
        await tx.auction.update({
          where: { id: auctionId },
          data: { endAt: new Date(auction.endAt.getTime() + 120000) },
        });
      }

      if (!highestBid) {
        // First bidder
        const bid = await tx.bid.create({
          data: {
            auctionId,
            bidderId: userId,
            amountCents: auction.startingBidCents,
            maxAutoBidCents: newMaxBid,
          },
          include: {
            bidder: { select: { id: true, name: true, avatarUrl: true } },
          },
        });

        await tx.listing.update({
          where: { id: auction.listingId },
          data: { priceCents: bid.amountCents },
        });
        await this.cache.deleteByPrefix("listings:search:");

        return bid;
      }

      const currentMaxBid =
        highestBid.maxAutoBidCents || highestBid.amountCents;

      if (userId === highestBid.bidderId) {
        // Same user increasing their max bid
        if (newMaxBid <= currentMaxBid) {
          throw new BadRequestException(
            "New max bid must be higher than current max bid",
          );
        }
        const bid = await tx.bid.update({
          where: { id: highestBid.id },
          data: { maxAutoBidCents: newMaxBid },
          include: {
            bidder: { select: { id: true, name: true, avatarUrl: true } },
          },
        });
        return bid;
      }

      if (newMaxBid > currentMaxBid) {
        // New bidder takes the lead
        // The new price is the old max + increment, but not exceeding the new max.
        const newPrice = Math.min(newMaxBid, currentMaxBid + minIncrement);

        const bid = await tx.bid.create({
          data: {
            auctionId,
            bidderId: userId,
            amountCents: newPrice,
            maxAutoBidCents: newMaxBid,
          },
          include: {
            bidder: { select: { id: true, name: true, avatarUrl: true } },
          },
        });

        await tx.listing.update({
          where: { id: auction.listingId },
          data: { priceCents: bid.amountCents },
        });
        await this.cache.deleteByPrefix("listings:search:");

        return bid;
      } else {
        // Old bidder stays in lead, but price increases
        // The new price is the new max + increment, but not exceeding old max.
        const newPrice = Math.min(currentMaxBid, newMaxBid + minIncrement);

        // Update the current highest bid record to reflect the new price challenge
        const updatedHighest = await tx.bid.create({
          data: {
            auctionId,
            bidderId: highestBid.bidderId,
            amountCents: newPrice,
            maxAutoBidCents: currentMaxBid,
          },
          include: {
            bidder: { select: { id: true, name: true, avatarUrl: true } },
          },
        });

        await tx.listing.update({
          where: { id: auction.listingId },
          data: { priceCents: updatedHighest.amountCents },
        });
        await this.cache.deleteByPrefix("listings:search:");

        // We return the updated highest bid so the caller knows who is winning
        return updatedHighest;
      }
    });

    // Emit event outside transaction
    this.auctionsGateway.emitBid(auctionId, createdBid);

    return createdBid;
  }

  private getMinIncrement(currentCents: number): number {
    if (currentCents < 500) return 25;
    if (currentCents < 2500) return 50;
    if (currentCents < 10000) return 100;
    return 250;
  }
}
