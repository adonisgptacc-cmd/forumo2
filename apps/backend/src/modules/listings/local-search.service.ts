import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class LocalSearchService {
  constructor(private prisma: PrismaService) {}

  /**
   * Search for listings within a radius (km) of a given latitude/longitude.
   * Uses Haversine formula via raw SQL.
   */
  async searchNearby(latitude: number, longitude: number, radiusKm: number) {
    // 6371 is Earth radius in km
    const result = await this.prisma.$queryRaw<
      { id: string; distance: number }[]
    >`
      SELECT id, (
        6371 * acos(
          cos(radians(${latitude})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(${longitude})) +
          sin(radians(${latitude})) * sin(radians(latitude))
        )
      ) AS distance
      FROM "Listing"
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND "deletedAt" IS NULL
        AND status = 'PUBLISHED'
        AND (
            6371 * acos(
            cos(radians(${latitude})) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(${longitude})) +
            sin(radians(${latitude})) * sin(radians(latitude))
            )
        ) < ${radiusKm}
      ORDER BY distance ASC
      LIMIT 50;
    `;

    // Fetch full listing details
    const listingIds = result.map((r) => r.id);
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: listingIds } },
      include: {
        images: true,
        seller: {
          select: { id: true, name: true, avatarUrl: true, trustScore: true },
        },
      },
    });

    // Re-merge distance info
    return listings
      .map((l) => {
        const dist = result.find((r) => r.id === l.id)?.distance || 0;
        return { ...l, distanceKm: dist };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }
}
