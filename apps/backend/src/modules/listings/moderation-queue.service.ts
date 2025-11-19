import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListingModerationStatus, ListingStatus, Prisma } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { SpanStatusCode, trace } from '@opentelemetry/api';

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

type ModerationEventDetails = {
  reason: string;
  notes?: string | null;
  score?: number;
  labels?: string[];
  metadata?: Prisma.JsonValue;
};

export interface ModerationQueueMetrics {
  available: boolean;
  waiting: number;
  delayed: number;
  failed: number;
  active: number;
  completed: number;
  backlogDepth: number;
  failureRate: number;
  deadLetterSize: number;
  lastFailureAt: string | null;
}

@Injectable()
export class ModerationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModerationQueueService.name);
  private readonly tracer = trace.getTracer('listings.moderation');
  private readonly serviceUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly queueName = 'listing-moderation';
  private readonly dlqName = 'listing-moderation:dlq';
  private readonly maxAttempts: number;
  private readonly backoffDelayMs: number;
  private readonly concurrency: number;

  private connection!: IORedis;
  private queue!: Queue<ModerationJobPayload>;
  private deadLetterQueue!: Queue<ModerationJobPayload>;
  private worker?: Worker<ModerationJobPayload>;
  private lastFailureAt: Date | null = null;
  private setupPromise?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.serviceUrl = this.configService.get<string>('MODERATION_SERVICE_URL') ?? 'http://localhost:5005';
    const timeoutValue = Number(this.configService.get<string>('MODERATION_SERVICE_TIMEOUT_MS') ?? 5000);
    this.requestTimeoutMs = Number.isNaN(timeoutValue) ? 5000 : timeoutValue;
    const attemptsValue = Number(this.configService.get<string>('MODERATION_MAX_ATTEMPTS') ?? 5);
    this.maxAttempts = Number.isNaN(attemptsValue) ? 5 : attemptsValue;
    const backoffValue = Number(this.configService.get<string>('MODERATION_RETRY_BACKOFF_MS') ?? 2000);
    this.backoffDelayMs = Number.isNaN(backoffValue) ? 2000 : backoffValue;
    const concurrencyValue = Number(this.configService.get<string>('MODERATION_WORKER_CONCURRENCY') ?? 2);
    this.concurrency = Number.isNaN(concurrencyValue) ? 2 : concurrencyValue;
  }

  async onModuleInit(): Promise<void> {
    if (!this.setupPromise) {
      this.beginInitialization();
    }
    await this.setupPromise;
  }

  private beginInitialization(): void {
    this.setupPromise = this.initializeQueues().catch((error) => {
      this.setupPromise = undefined;
      throw error;
    });
  }

  private async initializeQueues(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.connection = new IORedis(redisUrl);
    this.queue = new Queue(this.queueName, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: this.maxAttempts,
        removeOnComplete: true,
        removeOnFail: false,
        backoff: { type: 'exponential', delay: this.backoffDelayMs },
      },
    });
    this.deadLetterQueue = new Queue(this.dlqName, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    });

    this.worker = new Worker(
      this.queueName,
      async (job) => this.processJob(job),
      { connection: this.connection, concurrency: this.concurrency },
    );

    this.worker.on('failed', async (job, err) => {
      if (!job) {
        return;
      }
      this.lastFailureAt = new Date();
      this.logStructured('error', 'Listing moderation job failed', {
        jobId: job.id,
        listingId: job.data.listingId,
        attemptsMade: job.attemptsMade,
        error: err?.message ?? 'unknown',
      });

      const maxAttempts = job.opts.attempts ?? this.maxAttempts;
      if (job.attemptsMade >= maxAttempts) {
        await this.deadLetterQueue.add(this.queueName, job.data);
        await this.flagForManualReview(job.data.listingId);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.setupPromise?.catch(() => undefined);
    await Promise.all([
      this.worker?.close(),
      this.queue?.close(),
      this.deadLetterQueue?.close(),
      this.connection?.quit(),
    ]);
  }

  async enqueueListingScan(payload: ModerationJobPayload): Promise<void> {
    await this.ensureInitialized();
    const span = this.tracer.startSpan('moderation.enqueue', {
      attributes: {
        'listing.id': payload.listingId,
        'moderation.reason': payload.reason,
      },
    });
    try {
      await this.queue.add(this.queueName, payload);
      this.logStructured('log', 'Queued listing moderation job', {
        listingId: payload.listingId,
        sellerId: payload.sellerId,
        desiredStatus: payload.desiredStatus,
      });
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown moderation enqueue error';
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      this.logStructured('error', 'Failed to enqueue moderation job', {
        listingId: payload.listingId,
        sellerId: payload.sellerId,
        error: message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  private async processJob(job: Job<ModerationJobPayload>): Promise<void> {
    const span = this.tracer.startSpan('moderation.process', {
      attributes: {
        'listing.id': job.data.listingId,
        'job.id': job.id ?? 'unknown',
        'moderation.attempt': job.attemptsMade + 1,
      },
    });
    try {
      const listing = await this.prisma.listing.findFirst({
        where: { id: job.data.listingId },
        include: { images: true, variants: true },
      });

      if (!listing) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Listing not found' });
        this.logStructured('warn', 'Listing missing for moderation job', {
          listingId: job.data.listingId,
        });
        return;
      }

      const requestPayload = {
        listingId: listing.id,
        sellerId: listing.sellerId,
        reason: job.data.reason,
        title: listing.title,
        description: listing.description,
        priceCents: listing.priceCents,
        currency: listing.currency,
        desiredStatus: job.data.desiredStatus ?? listing.status,
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

      const response = await firstValueFrom(
        this.httpService.post<ModerationDecisionResponse>(
          `${this.serviceUrl}/moderations/listings`,
          requestPayload,
          { timeout: this.requestTimeoutMs },
        ),
      );
      await this.applyDecision(listing.id, response.data, job.data.desiredStatus ?? listing.status);
      this.logStructured('log', 'Moderation decision applied', {
        listingId: listing.id,
        status: response.data.status,
        score: response.data.score,
      });
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown moderation processing error';
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      this.logStructured('error', 'Moderation job processing failed', {
        listingId: job.data.listingId,
        error: message,
      });
      throw error;
    } finally {
      span.end();
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
    await this.recordModerationEvent(listingId, moderationStatus, {
      reason: 'automated_service_decision',
      notes: decision.notes,
      score: decision.score,
      labels: decision.labels,
      metadata: { sourceListingId: decision.listing_id },
    });
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
    await this.recordModerationEvent(listingId, ListingModerationStatus.FLAGGED, {
      reason: 'manual_review_required',
      notes: 'Automatic moderation unavailable. Manual review required.',
    });
  }

  private async recordModerationEvent(
    listingId: string,
    status: ListingModerationStatus,
    details: ModerationEventDetails,
  ): Promise<void> {
    await this.prisma.listingModerationEvent.create({
      data: {
        listingId,
        status,
        reason: details.reason,
        notes: details.notes ?? null,
        score: details.score ?? null,
        labels: details.labels ?? [],
        metadata: details.metadata ?? undefined,
      },
    });
  }

  async getMetrics(): Promise<ModerationQueueMetrics> {
    await this.ensureInitialized().catch(() => undefined);
    if (!this.queue || !this.deadLetterQueue) {
      return {
        available: false,
        waiting: 0,
        delayed: 0,
        failed: 0,
        active: 0,
        completed: 0,
        backlogDepth: 0,
        failureRate: 0,
        deadLetterSize: 0,
        lastFailureAt: null,
      };
    }

    const [jobCounts, dlqCounts] = await Promise.all([
      this.queue.getJobCounts('waiting', 'delayed', 'failed', 'completed', 'active'),
      this.deadLetterQueue.getJobCounts('waiting', 'failed'),
    ]);

    const waiting = jobCounts.waiting ?? 0;
    const delayed = jobCounts.delayed ?? 0;
    const failed = jobCounts.failed ?? 0;
    const completed = jobCounts.completed ?? 0;
    const processedTotal = completed + failed;
    const failureRate = processedTotal === 0 ? 0 : failed / processedTotal;
    const deadLetterSize = (dlqCounts.waiting ?? 0) + (dlqCounts.failed ?? 0);

    return {
      available: true,
      waiting,
      delayed,
      failed,
      active: jobCounts.active ?? 0,
      completed,
      backlogDepth: waiting + delayed,
      failureRate,
      deadLetterSize,
      lastFailureAt: this.lastFailureAt ? this.lastFailureAt.toISOString() : null,
    };
  }

  private logStructured(level: 'log' | 'error' | 'warn', message: string, context: Record<string, unknown>): void {
    const payload = JSON.stringify({ msg: message, ...context });
    this.logger[level](payload);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.queue) {
      return;
    }
    if (!this.setupPromise) {
      this.beginInitialization();
    }
    await this.setupPromise;
  }
}
