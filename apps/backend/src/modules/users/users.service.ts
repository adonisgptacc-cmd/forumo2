import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TrustScoreSeed, UserProfile } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { CreateTrustSeedDto } from "./dto/create-trust-seed.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { SafeUser, sanitizeUser } from "./user.serializer";

export interface UserProfileResponse {
  user: SafeUser;
  profile: UserProfile | null;
  trustSeeds: TrustScoreSeed[];
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return users.map((user) => sanitizeUser(user)!);
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return sanitizeUser(user)!;
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    await this.ensureExists(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
    });
    return sanitizeUser(updated)!;
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<SafeUser> {
    await this.ensureExists(id);

    const { bio, location, website: _website, ...userFields } = dto;

    const updated = await this.prisma.user.update({
      where: { id },
      data: { ...userFields },
    });

    if (bio !== undefined || location !== undefined) {
      await this.prisma.userProfile.upsert({
        where: { userId: id },
        create: { userId: id, bio, location },
        update: {
          ...(bio !== undefined ? { bio } : {}),
          ...(location !== undefined ? { location } : {}),
        },
      });
    }

    return sanitizeUser(updated)!;
  }

  async getProfile(id: string): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const [profile, trustSeeds] = await this.prisma.$transaction([
      this.prisma.userProfile.findUnique({ where: { userId: id } }),
      this.prisma.trustScoreSeed.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { user: sanitizeUser(user)!, profile, trustSeeds };
  }

  async listAddresses(userId: string) {
    await this.ensureExists(userId);
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  async createAddress(
    userId: string,
    dto: {
      label?: string;
      fullName: string;
      phone?: string;
      line1: string;
      line2?: string;
      city: string;
      state?: string;
      postalCode?: string;
      country: string;
      type?: string;
      isDefault?: boolean;
    },
  ) {
    await this.ensureExists(userId);
    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.userAddress.create({
      data: { userId, ...dto, type: (dto.type as any) ?? "SHIPPING" },
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: {
      label?: string;
      fullName?: string;
      phone?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      isDefault?: boolean;
    },
  ) {
    await this.ensureExists(userId);
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundException("Address not found");
    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.userAddress.update({
      where: { id: addressId },
      data: dto,
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    await this.ensureExists(userId);
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundException("Address not found");
    await this.prisma.userAddress.delete({ where: { id: addressId } });
  }

  async recordConsent(id: string): Promise<void> {
    await this.ensureExists(id);
    const now = new Date();
    await this.prisma.user.update({
      where: { id },
      data: { termsAcceptedAt: now, privacyAcceptedAt: now },
    });
  }

  async exportUserData(id: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException("User not found");

    const [
      profile,
      addresses,
      listings,
      ordersAsBuyer,
      ordersAsSeller,
      reviews,
      savedListings,
    ] = await this.prisma.$transaction([
      this.prisma.userProfile.findUnique({ where: { userId: id } }),
      this.prisma.userAddress.findMany({ where: { userId: id } }),
      this.prisma.listing.findMany({
        where: { sellerId: id },
        select: {
          id: true,
          title: true,
          priceCents: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.order.findMany({
        where: { buyerId: id },
        select: {
          id: true,
          status: true,
          totalItemCents: true,
          createdAt: true,
        },
      }),
      this.prisma.order.findMany({
        where: { sellerId: id },
        select: {
          id: true,
          status: true,
          totalItemCents: true,
          createdAt: true,
        },
      }),
      this.prisma.review.findMany({
        where: { reviewerId: id },
        select: { id: true, rating: true, comment: true, createdAt: true },
      }),
      this.prisma.savedListing.findMany({
        where: { userId: id },
        select: { listingId: true, createdAt: true },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      account: sanitizeUser(user),
      profile,
      addresses,
      listings,
      ordersAsBuyer,
      ordersAsSeller,
      reviews,
      savedListings,
    };
  }

  async removeAvatar(id: string): Promise<SafeUser> {
    await this.ensureExists(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { avatarUrl: null },
    });
    return sanitizeUser(updated)!;
  }

  async listTrustSeeds(id: string): Promise<TrustScoreSeed[]> {
    await this.ensureExists(id);
    return this.prisma.trustScoreSeed.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    });
  }

  async createTrustSeed(
    userId: string,
    dto: CreateTrustSeedDto,
    createdBy: string,
  ): Promise<TrustScoreSeed> {
    await this.ensureExists(userId);
    const seed = await this.prisma.trustScoreSeed.create({
      data: {
        userId,
        label: dto.label,
        value: dto.value,
        createdBy,
        metadata: this.buildMetadata(dto.metadata),
      },
    });
    await this.recalculateTrustScore(userId);
    return seed;
  }

  async deleteTrustSeed(userId: string, seedId: string): Promise<void> {
    await this.ensureExists(userId);
    const seed = await this.prisma.trustScoreSeed.findFirst({
      where: { id: seedId, userId },
    });
    if (!seed) {
      throw new NotFoundException("Trust score seed not found");
    }

    await this.prisma.trustScoreSeed.delete({ where: { id: seedId } });
    await this.recalculateTrustScore(userId);
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!exists) {
      throw new NotFoundException("User not found");
    }
  }

  private async recalculateTrustScore(userId: string): Promise<void> {
    const aggregate = await this.prisma.trustScoreSeed.aggregate({
      where: { userId },
      _sum: { value: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { trustScore: aggregate._sum.value ?? 0 },
    });
  }

  async becomeSeller(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException("User not found");
    if (
      user.role === "SELLER" ||
      user.role === "ADMIN" ||
      user.role === "MODERATOR"
    ) {
      throw new BadRequestException(
        "Account is already a seller or higher role",
      );
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: "SELLER" },
    });
    return sanitizeUser(updated)!;
  }

  private buildMetadata(
    metadata?: Record<string, unknown>,
  ): Prisma.JsonObject | undefined {
    if (!metadata || Object.keys(metadata).length === 0) {
      return undefined;
    }

    return metadata as Prisma.JsonObject;
  }
}
