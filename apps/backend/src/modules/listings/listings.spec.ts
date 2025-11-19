import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Listing,
  ListingImage,
  ListingModerationStatus,
  ListingStatus,
  ListingVariant,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingsModule } from './listings.module.js';
import { ListingWithRelations } from './listing.serializer.js';
import { ModerationQueueService } from './moderation-queue.service.js';

const SELLER_ID = 'seller-1';

describe('ListingsModule (smoke)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const prismaMock = new InMemoryPrismaService();
    const moduleRef = await Test.createTestingModule({
      imports: [ListingsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(ModerationQueueService)
      .useValue(new ImmediateModerationQueueService(prismaMock))
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates, reads, updates, and deletes listings', async () => {
    const payload = {
      sellerId: SELLER_ID,
      title: 'Vintage Kente Fabric',
      description: 'Handwoven Kente cloth direct from artisans.',
      priceCents: 45000,
      status: ListingStatus.PUBLISHED,
      variants: [
        { label: '2 yards', priceCents: 45000, inventoryCount: 4 },
        { label: '4 yards', priceCents: 80000, inventoryCount: 2 },
      ],
    };

    const createRes = await request(app.getHttpServer()).post('/listings').send(payload).expect(201);
    expect(createRes.body.title).toBe(payload.title);
    expect(createRes.body.variants).toHaveLength(2);

    const listingId = createRes.body.id;

    const listRes = await request(app.getHttpServer()).get('/listings').expect(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body[0].id).toBe(listingId);

    const updateRes = await request(app.getHttpServer())
      .patch(`/listings/${listingId}`)
      .send({ title: 'Updated title' })
      .expect(200);
    expect(updateRes.body.title).toBe('Updated title');

    await request(app.getHttpServer()).delete(`/listings/${listingId}`).expect(204);
    await request(app.getHttpServer()).get(`/listings/${listingId}`).expect(404);
  });
});

class InMemoryPrismaService {
  private listings = new Map<string, ListingRecord>();
  private variants = new Map<string, ListingVariantRecord>();
  private images = new Map<string, ListingImageRecord>();
  private users = new Map<string, { id: string; deletedAt: Date | null }>([
    [SELLER_ID, { id: SELLER_ID, deletedAt: null }],
  ]);

  user = {
    findFirst: async ({ where }: { where: { id: string; deletedAt: null } }) => {
      const user = this.users.get(where.id);
      if (!user || user.deletedAt) {
        return null;
      }
      return user;
    },
  };

  listing = {
    findMany: async ({ where, orderBy, include }: any) => {
      let results = Array.from(this.listings.values()).filter((listing) => !listing.deletedAt);
      if (where?.sellerId) {
        results = results.filter((listing) => listing.sellerId === where.sellerId);
      }
      if (orderBy?.createdAt === 'desc') {
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return results.map((listing) => this.buildListing(listing, include));
    },
    findFirst: async ({ where, include }: any) => {
      const match = Array.from(this.listings.values()).find((listing) => {
        if (where.id && listing.id !== where.id) {
          return false;
        }
        if (where.deletedAt === null && listing.deletedAt !== null) {
          return false;
        }
        return true;
      });
      if (!match) {
        return null;
      }
      return this.buildListing(match, include);
    },
    create: async ({ data }: { data: Partial<Listing> }) => {
      const now = new Date();
      const record: ListingRecord = {
        id: data.id ?? randomUUID(),
        sellerId: data.sellerId!,
        title: data.title!,
        description: data.description!,
        priceCents: data.priceCents!,
        currency: data.currency ?? 'USD',
        status: data.status ?? ListingStatus.DRAFT,
        moderationStatus: data.moderationStatus!,
        moderationNotes: data.moderationNotes ?? null,
        metadata: data.metadata ?? null,
        location: data.location ?? null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.listings.set(record.id, record);
      return { ...record };
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Listing> }) => {
      const listing = this.listings.get(where.id);
      if (!listing) {
        throw new Error('Listing not found');
      }
      Object.assign(listing, data);
      listing.updatedAt = new Date();
      return { ...listing };
    },
  };

  listingVariant = {
    deleteMany: async ({ where }: { where: { listingId: string } }) => {
      let count = 0;
      for (const [key, variant] of this.variants.entries()) {
        if (variant.listingId === where.listingId) {
          this.variants.delete(key);
          count += 1;
        }
      }
      return { count };
    },
    createMany: async ({ data }: { data: ListingVariantCreateInput[] }) => {
      data.forEach((variant) => {
        const record: ListingVariantRecord = {
          id: randomUUID(),
          listingId: variant.listingId,
          label: variant.label,
          priceCents: variant.priceCents,
          currency: variant.currency ?? 'USD',
          sku: variant.sku ?? null,
          inventoryCount: variant.inventoryCount ?? 0,
          metadata: variant.metadata ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.variants.set(record.id, record);
      });
      return { count: data.length };
    },
  };

  listingImage = {
    count: async ({ where }: { where: { listingId: string } }) => {
      return Array.from(this.images.values()).filter((image) => image.listingId === where.listingId).length;
    },
    create: async ({ data }: { data: Partial<ListingImage> & { listingId: string } }) => {
      const record: ListingImageRecord = {
        id: randomUUID(),
        listingId: data.listingId,
        bucket: data.bucket!,
        storageKey: data.storageKey!,
        url: data.url!,
        mimeType: data.mimeType ?? null,
        fileSize: data.fileSize ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        position: data.position ?? 0,
        createdAt: new Date(),
      };
      this.images.set(record.id, record);
      return { ...record };
    },
  };

  private buildListing(listing: ListingRecord, include?: any): Listing | ListingWithRelations {
    if (!include) {
      return { ...listing };
    }
    const enriched: ListingWithRelations = {
      ...(listing as Listing),
      images: include.images ? this.getImages(listing.id) : [],
      variants: include.variants ? this.getVariants(listing.id) : [],
    };
    return enriched;
  }

  private getVariants(listingId: string): ListingVariantRecord[] {
    return Array.from(this.variants.values()).filter((variant) => variant.listingId === listingId);
  }

  private getImages(listingId: string): ListingImageRecord[] {
    return Array.from(this.images.values())
      .filter((image) => image.listingId === listingId)
      .sort((a, b) => a.position - b.position);
  }
}

class ImmediateModerationQueueService {
  constructor(private readonly prisma: InMemoryPrismaService) {}

  async enqueueListingScan(payload: { listingId: string; desiredStatus?: ListingStatus }): Promise<void> {
    await this.prisma.listing.update({
      where: { id: payload.listingId },
      data: {
        moderationStatus: ListingModerationStatus.APPROVED,
        status: payload.desiredStatus ?? ListingStatus.DRAFT,
      },
    });
  }
}

type ListingRecord = Listing;
type ListingVariantRecord = ListingVariant;
type ListingImageRecord = ListingImage;

type ListingVariantCreateInput = {
  listingId: string;
  label: string;
  priceCents: number;
  currency?: string;
  sku?: string | null;
  inventoryCount?: number;
  metadata?: Prisma.JsonValue | null;
};
