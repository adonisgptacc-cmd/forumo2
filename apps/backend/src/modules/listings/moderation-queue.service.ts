import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListingModerationStatus, ListingStatus, Prisma } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

import { PrismaService } from '../../prisma/prisma.service.js';

interface ModerationJobPayload {
  listingId: string;
  sellerId: string;
  reason: string;
  desiredStatus?: ListingStatus;
}

interface ModerationDecisionResponse {
  listing_id: string;
  status: 'approved' | 'flagged' | 'rejected';
  score: number;
  labels: string[];
  notes?: string | null;
}

@Injectable()
export class ModerationQueueService {
  private readonly logger = new Logger(ModerationQueueService.name);
  private readonly serviceUrl: string;
  private readonly requestTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.serviceUrl = this.configService.get<string>('MODERATION_SERVICE_URL') ?? 'http://localhost:5005';
    const timeoutValue = Number(this.configService.get<string>('MODERATION_SERVICE_TIMEOUT_MS') ?? 5000);
    this.requestTimeoutMs = Number.isNaN(timeoutValue) ? 5000 : timeoutValue;
  }

  async enqueueListingScan(payload: ModerationJobPayload): Promise<void> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: payload.listingId },
      include: { images: true, variants: true },
    });

    if (!listing) {
      this.logger.warn(`Listing ${payload.listingId} missing for moderation.`);
      return;
    }

    const requestPayload = {
      listingId: listing.id,
      sellerId: listing.sellerId,
      reason: payload.reason,
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents,
      currency: listing.currency,
      desiredStatus: payload.desiredStatus ?? listing.status,
      images: listing.images.map((image) => ({
        id: image.id,
        url: image.url,
        mime_type: image.mimeType,
        file_size: image.fileSize,
      })),
      variants: listing.variants.map((variant) => ({
        id: variant.id,
        label: variant.label,
        price_cents: variant.priceCents,
        currency: variant.currency,
        sku: variant.sku,
      })),
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<ModerationDecisionResponse>(
          `${this.serviceUrl}/moderations/listings`,
          requestPayload,
          { timeout: this.requestTimeoutMs },
        ),
      );
      await this.applyDecision(listing.id, response.data, payload.desiredStatus ?? listing.status);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown moderation error';
      this.logger.error(`Moderation service request failed for listing ${listing.id}: ${message}`);
      await this.flagForManualReview(listing.id);
    }
  }

  private async applyDecision(
    listingId: string,
    decision: ModerationDecisionResponse,
    desiredStatus?: ListingStatus,
  ): Promise<void> {
    const statusMap: Record<ModerationDecisionResponse['status'], ListingModerationStatus> = {
      approved: ListingModerationStatus.APPROVED,
      flagged: ListingModerationStatus.FLAGGED,
      rejected: ListingModerationStatus.REJECTED,
    };

    const moderationStatus = statusMap[decision.status] ?? ListingModerationStatus.FLAGGED;
    const data: Prisma.ListingUpdateInput = {
      moderationStatus,
      moderationNotes: decision.notes ?? null,
    };

    if (moderationStatus === ListingModerationStatus.APPROVED && desiredStatus) {
      data.status = desiredStatus;
    } else if (moderationStatus !== ListingModerationStatus.APPROVED) {
      data.status = ListingStatus.PAUSED;
    }

    await this.prisma.listing.update({ where: { id: listingId }, data });
  }

  private async flagForManualReview(listingId: string): Promise<void> {
    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        moderationStatus: ListingModerationStatus.FLAGGED,
        moderationNotes: 'Automatic moderation unavailable. Manual review required.',
        status: ListingStatus.PAUSED,
      },
    });
  }
}
