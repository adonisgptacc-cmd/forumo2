import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async getWishlist(userId: string) {
    return this.prisma.savedListing.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            priceCents: true,
            currency: true,
            status: true,
            images: { take: 1, select: { url: true } },
          },
        },
      },
    });
  }

  async save(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const existing = await this.prisma.savedListing.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });
    if (existing) {
      throw new ConflictException('Already saved');
    }

    return this.prisma.savedListing.create({
      data: { userId, listingId },
      include: {
        listing: {
          select: { id: true, title: true, priceCents: true, currency: true, status: true },
        },
      },
    });
  }

  async remove(userId: string, listingId: string) {
    const existing = await this.prisma.savedListing.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });
    if (!existing) {
      throw new NotFoundException('Not in wishlist');
    }
    await this.prisma.savedListing.delete({
      where: { userId_listingId: { userId, listingId } },
    });
  }

  async isSaved(userId: string, listingId: string): Promise<boolean> {
    const saved = await this.prisma.savedListing.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });
    return !!saved;
  }
}
