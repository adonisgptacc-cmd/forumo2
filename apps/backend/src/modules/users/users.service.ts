import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TrustScoreSeed, UserProfile } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateTrustSeedDto } from './dto/create-trust-seed.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { SafeUser, sanitizeUser } from './user.serializer.js';

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
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => sanitizeUser(user)!);
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) {
      throw new NotFoundException('User not found');
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
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
      },
    });
    return sanitizeUser(updated)!;
  }

  async getProfile(id: string): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [profile, trustSeeds] = await this.prisma.$transaction([
      this.prisma.userProfile.findUnique({ where: { userId: id } }),
      this.prisma.trustScoreSeed.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }),
    ]);

    return { user: sanitizeUser(user)!, profile, trustSeeds };
  }

  async removeAvatar(id: string): Promise<SafeUser> {
    await this.ensureExists(id);
    const updated = await this.prisma.user.update({ where: { id }, data: { avatarUrl: null } });
    return sanitizeUser(updated)!;
  }

  async listTrustSeeds(id: string): Promise<TrustScoreSeed[]> {
    await this.ensureExists(id);
    return this.prisma.trustScoreSeed.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } });
  }

  async createTrustSeed(userId: string, dto: CreateTrustSeedDto, createdBy: string): Promise<TrustScoreSeed> {
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
    const seed = await this.prisma.trustScoreSeed.findFirst({ where: { id: seedId, userId } });
    if (!seed) {
      throw new NotFoundException('Trust score seed not found');
    }

    await this.prisma.trustScoreSeed.delete({ where: { id: seedId } });
    await this.recalculateTrustScore(userId);
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!exists) {
      throw new NotFoundException('User not found');
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

  private buildMetadata(metadata?: Record<string, unknown>): Prisma.JsonObject | undefined {
    if (!metadata || Object.keys(metadata).length === 0) {
      return undefined;
    }

    return metadata as Prisma.JsonObject;
  }
}
