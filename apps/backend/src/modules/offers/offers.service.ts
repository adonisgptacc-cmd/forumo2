import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { ListingStatus, OrderStatus } from "@prisma/client";
import { sanitizeText } from "../../common/utils/sanitize";
import { CacheService } from "../../common/services/cache.service";

@Injectable()
export class OffersService {
  constructor(
    private prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(buyerId: string, dto: CreateOfferDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
    });

    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.sellerId === buyerId)
      throw new ForbiddenException("Cannot offer on own item");
    if (listing.status !== ListingStatus.PUBLISHED)
      throw new BadRequestException("Listing not active");

    const existing = await this.prisma.offer.findFirst({
      where: {
        listingId: dto.listingId,
        buyerId: buyerId,
        status: "PENDING",
      },
    });

    if (existing) {
      throw new BadRequestException(
        "You already have a pending offer on this item",
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3);

    return this.prisma.offer.create({
      data: {
        listingId: dto.listingId,
        buyerId,
        sellerId: listing.sellerId,
        amountCents: dto.amountCents,
        currency: listing.currency,
        message: dto.message ? sanitizeText(dto.message) : dto.message,
        expiresAt,
        status: "PENDING",
      },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.offer.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
      include: {
        listing: { select: { id: true, title: true, images: { take: 1 } } },
        buyer: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async accept(userId: string, offerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId } });
      if (!offer) throw new NotFoundException("Offer not found");

      if (offer.sellerId !== userId)
        throw new ForbiddenException("Only the seller can accept offers");
      if (offer.status !== "PENDING")
        throw new BadRequestException("Offer not pending");
      if (offer.expiresAt && offer.expiresAt < new Date())
        throw new BadRequestException("Offer has expired");

      const updated = await tx.offer.update({
        where: { id: offerId },
        data: { status: "ACCEPTED" },
      });

      await tx.offer.updateMany({
        where: {
          listingId: offer.listingId,
          status: "PENDING",
          NOT: { id: offerId },
        },
        data: { status: "DECLINED" },
      });

      const listing = await tx.listing.findUnique({
        where: { id: offer.listingId },
      });

      const orderNumber = "ORD-" + randomBytes(8).toString("hex").toUpperCase();
      await tx.order.create({
        data: {
          orderNumber,
          buyerId: offer.buyerId,
          sellerId: offer.sellerId,
          status: OrderStatus.PENDING,
          totalItemCents: offer.amountCents,
          currency: offer.currency,
          items: {
            create: {
              listingId: offer.listingId,
              listingTitle: listing?.title || "Listing",
              unitPriceCents: offer.amountCents,
              currency: offer.currency,
              quantity: 1,
            },
          },
        },
      });

      await tx.listing.update({
        where: { id: offer.listingId },
        data: { status: ListingStatus.PAUSED },
      });
      await this.cache.deleteByPrefix("listings:search:");

      return updated;
    });
  }

  async decline(userId: string, offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
    });
    if (!offer) throw new NotFoundException("Offer not found");

    if (offer.sellerId !== userId)
      throw new ForbiddenException("Only seller can decline");
    if (offer.status !== "PENDING")
      throw new BadRequestException("Offer is no longer pending");
    if (offer.expiresAt && offer.expiresAt < new Date())
      throw new BadRequestException("Offer has expired");

    return this.prisma.offer.update({
      where: { id: offerId },
      data: { status: "DECLINED" },
    });
  }
}
