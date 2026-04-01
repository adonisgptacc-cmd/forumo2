import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStorefrontDto } from './dto/create-storefront.dto';

@Injectable()
export class StorefrontsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateStorefrontDto) {
    const existing = await this.prisma.storefront.findFirst({
      where: { OR: [{ slug: dto.slug }, { userId }] },
    });

    if (existing) {
      if (existing.userId === userId) throw new ConflictException('User already has a storefront');
      throw new ConflictException('Slug already taken');
    }

    return this.prisma.storefront.create({
      data: { userId, name: dto.name, slug: dto.slug, description: dto.description },
    });
  }

  async findBySlug(slug: string) {
    const storefront = await this.prisma.storefront.findUnique({
      where: { slug },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        collections: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!storefront) throw new NotFoundException('Storefront not found');
    return storefront;
  }

  async findByUser(userId: string) {
    return this.prisma.storefront.findUnique({
      where: { userId },
      include: { collections: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async update(userId: string, data: { name?: string; description?: string; logoUrl?: string; bannerUrl?: string }) {
    const storefront = await this.prisma.storefront.findUnique({ where: { userId } });
    if (!storefront) throw new NotFoundException('Storefront not found');
    return this.prisma.storefront.update({ where: { userId }, data });
  }

  async remove(userId: string) {
    const storefront = await this.prisma.storefront.findUnique({ where: { userId } });
    if (!storefront) throw new NotFoundException('Storefront not found');
    await this.prisma.storefront.delete({ where: { userId } });
  }

  // --- Collections ---

  async listCollections(userId: string) {
    const storefront = await this.prisma.storefront.findUnique({ where: { userId } });
    if (!storefront) throw new NotFoundException('Storefront not found');
    return this.prisma.collection.findMany({
      where: { storefrontId: storefront.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCollection(userId: string, data: { name: string; slug: string; description?: string; productIds?: string[] }) {
    const storefront = await this.prisma.storefront.findUnique({ where: { userId } });
    if (!storefront) throw new NotFoundException('Create a storefront first');
    return this.prisma.collection.create({
      data: {
        storefrontId: storefront.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        productIds: data.productIds ?? [],
      },
    });
  }

  async updateCollection(userId: string, collectionId: string, data: { name?: string; description?: string; productIds?: string[] }) {
    const storefront = await this.prisma.storefront.findUnique({ where: { userId } });
    if (!storefront) throw new NotFoundException('Storefront not found');
    const col = await this.prisma.collection.findFirst({ where: { id: collectionId, storefrontId: storefront.id } });
    if (!col) throw new NotFoundException('Collection not found');
    return this.prisma.collection.update({ where: { id: collectionId }, data });
  }

  async deleteCollection(userId: string, collectionId: string) {
    const storefront = await this.prisma.storefront.findUnique({ where: { userId } });
    if (!storefront) throw new NotFoundException('Storefront not found');
    const col = await this.prisma.collection.findFirst({ where: { id: collectionId, storefrontId: storefront.id } });
    if (!col) throw new NotFoundException('Collection not found');
    await this.prisma.collection.delete({ where: { id: collectionId } });
  }
}
