import type { Express } from 'express';
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Listing, ListingModerationStatus, ListingStatus, Prisma } from '@prisma/client';

import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { sanitizeText } from "../../common/utils/sanitize";
import { CreateListingDto, CreateListingVariantDto } from "./dto/create-listing.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";
import {
  ListingWithRelations,
  SafeListing,
  SafeListingImage,
  serializeListing,
  serializeListingImage,
} from "./listing.serializer";
import { listingDefaultInclude } from "./listings.prisma";
import { ModerationQueueService } from "./moderation-queue.service";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationQueue: ModerationQueueService,
    private readonly storageService: StorageService,
    private readonly notifications: NotificationsService,
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

  async create(dto: CreateListingDto, sellerId: string): Promise<SafeListing> {
    await this.ensureSellerExists(sellerId);

    const requestedStatus = dto.status ?? ListingStatus.DRAFT;
    const initialStatus = requestedStatus === ListingStatus.PUBLISHED ? ListingStatus.PAUSED : requestedStatus;

    const listing = await this.prisma.listing.create({
      data: {
        sellerId,
        title: sanitizeText(dto.title),
        description: dto.description ? sanitizeText(dto.description) : dto.description,
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
      sellerId,
      reason: 'listing_created',
      desiredStatus: requestedStatus,
    });

    this.logger.log(`Listing ${listing.id} created for seller ${sellerId}`);
    return this.findById(listing.id);
  }

  async update(id: string, dto: UpdateListingDto, userId: string): Promise<SafeListing> {
    const current = await this.ensureListingExists(id);
    if (current.sellerId !== userId) throw new ForbiddenException('Not your listing');
    const desiredStatus = dto.status ?? current.status;
    const data: Prisma.ListingUpdateInput = {
      title: dto.title != null ? sanitizeText(dto.title) : undefined,
      description: dto.description != null ? sanitizeText(dto.description) : undefined,
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

  async softDelete(id: string, userId: string): Promise<void> {
    const listing = await this.ensureListingExists(id);
    if (listing.sellerId !== userId) throw new ForbiddenException('Not your listing');
    await this.prisma.listing.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async attachImage(id: string, file: Express.Multer.File, userId: string): Promise<SafeListingImage> {
    const listing = await this.ensureListingExists(id);
    if (listing.sellerId !== userId) throw new ForbiddenException('Not your listing');
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

  async reportListing(
    listingId: string,
    reporterId: string,
    reason: string,
  ): Promise<{ message: string }> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null },
      select: { id: true, title: true, sellerId: true, moderationStatus: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    // Flag the listing for admin review
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { moderationStatus: ListingModerationStatus.FLAGGED },
    });

    // Write to audit log
    await this.prisma.auditLog.create({
      data: {
        actorId: reporterId,
        action: 'listing.report',
        entityType: 'listing',
        entityId: listingId,
        payload: this.toJsonInput({ reason, listingTitle: listing.title }) ?? Prisma.JsonNull,
      },
    });

    // Notify admin
    void this.notifications.notifyDisputeOpened(
      listingId,
      `report:${listingId}`,
      `User report on listing "${listing.title}": ${reason}`,
    ).catch(() => undefined);

    return { message: 'Report submitted. Our team will review this listing.' };
  }

}
