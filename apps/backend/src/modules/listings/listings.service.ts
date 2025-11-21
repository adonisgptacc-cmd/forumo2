import type { Express } from 'express';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Listing, ListingModerationStatus, ListingStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateListingDto, CreateListingVariantDto } from './dto/create-listing.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import {
  ListingWithRelations,
  SafeListing,
  SafeListingImage,
  serializeListing,
  serializeListingImage,
} from './listing.serializer.js';
import { listingDefaultInclude } from './listings.prisma.js';
import { ModerationQueueService } from './moderation-queue.service.js';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationQueue: ModerationQueueService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(): Promise<SafeListing[]> {
    const listings = await this.prisma.listing.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: listingDefaultInclude,
    });
    return listings.map((listing) => serializeListing(listing));
  }

  async findById(id: string): Promise<SafeListing> {
    const listing = await this.prisma.listing.findFirst({
      where: { id, deletedAt: null },
      include: listingDefaultInclude,
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return serializeListing(listing);
  }

  async create(dto: CreateListingDto): Promise<SafeListing> {
    await this.ensureSellerExists(dto.sellerId);

    const requestedStatus = dto.status ?? ListingStatus.DRAFT;
    const initialStatus = requestedStatus === ListingStatus.PUBLISHED ? ListingStatus.PAUSED : requestedStatus;

    const listing = await this.prisma.listing.create({
      data: {
        sellerId: dto.sellerId,
        title: dto.title,
        description: dto.description,
        priceCents: dto.priceCents,
        currency: dto.currency ?? 'USD',
        status: initialStatus,
        location: dto.location,
        metadata: this.toJsonInput(dto.metadata),
        moderationStatus: ListingModerationStatus.PENDING,
      },
    });

    if (dto.variants?.length) {
      await this.createVariants(listing.id, dto.variants);
    }

    await this.moderationQueue.enqueueListingScan({
      listingId: listing.id,
      sellerId: listing.sellerId,
      reason: 'listing_created',
      desiredStatus: requestedStatus,
    });

    this.logger.log(`Listing ${listing.id} created for seller ${listing.sellerId}`);
    return this.findById(listing.id);
  }

  async update(id: string, dto: UpdateListingDto): Promise<SafeListing> {
    const current = await this.ensureListingExists(id);
    const desiredStatus = dto.status ?? current.status;
    const data: Prisma.ListingUpdateInput = {
      title: dto.title ?? undefined,
      description: dto.description ?? undefined,
      priceCents: dto.priceCents ?? undefined,
      currency: dto.currency ?? undefined,
      status: dto.status ?? undefined,
      location: dto.location ?? undefined,
      metadata: this.toJsonInput(dto.metadata),
    };

    const shouldRemoderate = this.requiresRemoderation(dto);
    if (shouldRemoderate) {
      data.moderationStatus = ListingModerationStatus.PENDING;
      data.moderationNotes = null;
      if (desiredStatus === ListingStatus.PUBLISHED || current.status === ListingStatus.PUBLISHED) {
        data.status = ListingStatus.PAUSED;
      }
    }

    await this.prisma.listing.update({ where: { id }, data });

    if (dto.variants !== undefined) {
      await this.prisma.listingVariant.deleteMany({ where: { listingId: id } });
      if (dto.variants.length) {
        await this.createVariants(id, dto.variants);
      }
    }

    if (shouldRemoderate || dto.variants !== undefined) {
      await this.moderationQueue.enqueueListingScan({
        listingId: id,
        sellerId: current.sellerId,
        reason: 'listing_updated',
        desiredStatus,
      });
    }

    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureListingExists(id);
    await this.prisma.listing.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async attachImage(id: string, file: Express.Multer.File): Promise<SafeListingImage> {
    const listing = await this.ensureListingExists(id);
    const desiredStatus = listing.status;
    const shouldPause = listing.status === ListingStatus.PUBLISHED;
    await this.prisma.listing.update({
      where: { id },
      data: {
        moderationStatus: ListingModerationStatus.PENDING,
        moderationNotes: null,
        ...(shouldPause ? { status: ListingStatus.PAUSED } : {}),
      },
    });
    const storedObject = await this.storageService.saveListingImage(id, file);
    const position = await this.prisma.listingImage.count({ where: { listingId: id } });
    const image = await this.prisma.listingImage.create({
      data: {
        listingId: id,
        bucket: storedObject.bucket,
        storageKey: storedObject.key,
        url: storedObject.url,
        mimeType: file.mimetype,
        fileSize: file.size,
        position,
      },
    });

    await this.moderationQueue.enqueueListingScan({
      listingId: id,
      sellerId: listing.sellerId,
      reason: 'image_uploaded',
      desiredStatus,
    });

    return serializeListingImage(image);
  }

  private async ensureSellerExists(sellerId: string): Promise<void> {
    const seller = await this.prisma.user.findFirst({ where: { id: sellerId, deletedAt: null } });
    if (!seller) {
      throw new NotFoundException('Seller not found');
    }
  }

  private async ensureListingExists(id: string): Promise<Pick<Listing, 'id' | 'sellerId' | 'status'>> {
    const listing = await this.prisma.listing.findFirst({ where: { id, deletedAt: null } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return listing;
  }

  private requiresRemoderation(dto: UpdateListingDto): boolean {
    return Boolean(
      dto.title ??
        dto.description ??
        dto.priceCents ??
        dto.metadata ??
        dto.location ??
        dto.status ??
        dto.variants !== undefined,
    );
  }

  private async createVariants(listingId: string, variants: CreateListingVariantDto[]): Promise<void> {
    await this.prisma.listingVariant.createMany({
      data: variants.map((variant) => ({
        listingId,
        label: variant.label,
        priceCents: variant.priceCents,
        currency: variant.currency ?? 'USD',
        sku: variant.sku,
        inventoryCount: variant.inventoryCount ?? 0,
        metadata: this.toJsonInput(variant.metadata),
      })),
    });
  }

  private toJsonInput(
    value?: Record<string, unknown> | null,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
  }

}
