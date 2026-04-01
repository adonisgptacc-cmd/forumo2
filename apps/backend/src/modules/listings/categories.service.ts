import { ForbiddenException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Categories ----

  async listCategories() {
    return this.prisma.listingCategory.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { children: { orderBy: [{ position: 'asc' }, { name: 'asc' }] } },
    });
  }

  async createCategory(data: { slug: string; name: string; description?: string; parentId?: string; position?: number }) {
    const existing = await this.prisma.listingCategory.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('Category slug already exists');
    return this.prisma.listingCategory.create({ data });
  }

  async updateCategory(id: string, data: { name?: string; description?: string; parentId?: string; position?: number }) {
    const cat = await this.prisma.listingCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    return this.prisma.listingCategory.update({ where: { id }, data });
  }

  async deleteCategory(id: string) {
    const cat = await this.prisma.listingCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    await this.prisma.listingCategory.delete({ where: { id } });
  }

  // ---- Tags ----

  async listTags() {
    return this.prisma.listingTag.findMany({ orderBy: { label: 'asc' } });
  }

  async createTag(data: { slug: string; label: string }) {
    const existing = await this.prisma.listingTag.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('Tag slug already exists');
    return this.prisma.listingTag.create({ data });
  }

  async updateTag(id: string, data: { label?: string }) {
    const tag = await this.prisma.listingTag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    return this.prisma.listingTag.update({ where: { id }, data });
  }

  async deleteTag(id: string) {
    const tag = await this.prisma.listingTag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.prisma.listingTag.delete({ where: { id } });
  }

  // ---- Listing assignments ----

  async assignCategoriesToListing(listingId: string, userId: string, categoryIds: string[], primaryCategoryId?: string) {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, deletedAt: null } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== userId) throw new ForbiddenException('Not your listing');
    await this.prisma.listingCategoryAssignment.deleteMany({ where: { listingId } });
    if (categoryIds.length > 0) {
      await this.prisma.listingCategoryAssignment.createMany({
        data: categoryIds.map((categoryId) => ({
          listingId,
          categoryId,
          isPrimary: categoryId === primaryCategoryId,
        })),
      });
    }
  }

  async assignTagsToListing(listingId: string, userId: string, tagIds: string[]) {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, deletedAt: null } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== userId) throw new ForbiddenException('Not your listing');
    await this.prisma.listingTagAssignment.deleteMany({ where: { listingId } });
    if (tagIds.length > 0) {
      await this.prisma.listingTagAssignment.createMany({
        data: tagIds.map((tagId) => ({ listingId, tagId })),
      });
    }
  }
}
