import type { Express } from 'express';
import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { MessageModerationStatus, MessageStatus, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { CreateThreadDto } from "./dto/create-thread.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { ThreadQueryDto } from "./dto/thread-query.dto";
import { MessageThreadWithRelations, SafeMessageThread, serializeThread } from "./message.serializer";
import { MessagingGateway } from "./messaging.gateway";
import { MessageModerationService } from "./moderation.service";
import { CacheService } from "../../common/services/cache.service";

interface AttachmentInput {
  bucket: string;
  storageKey: string;
  url: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly moderation: MessageModerationService,
    @Inject(forwardRef(() => MessagingGateway))
    private readonly messagingGateway: MessagingGateway,
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async listThreads(query: ThreadQueryDto): Promise<{
    data: SafeMessageThread[];
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const where: Prisma.MessageThreadWhereInput = {
      participants: query.userId ? { some: { userId: query.userId } } : undefined,
      listingId: query.listingId ?? undefined,
    };

    const cacheKey = this.buildCacheKey({ ...query, page, pageSize });
    const cached = await this.cache.get<{
      data: SafeMessageThread[];
      total: number;
      page: number;
      pageSize: number;
      pageCount: number;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    const [total, threads] = await this.prisma.$transaction([
      this.prisma.messageThread.count({ where }),
      this.prisma.messageThread.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: this.defaultInclude,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const pageCount = pageSize === 0 ? 0 : Math.max(1, Math.ceil(total / pageSize));
    const response = {
      data: threads.map((thread) => serializeThread(thread)),
      total,
      page,
      pageSize,
      pageCount,
    };

    await this.cache.set(cacheKey, response, this.cacheTtlMs);
    return response;
  }

  async getThread(id: string): Promise<SafeMessageThread> {
    const thread = await this.prisma.messageThread.findFirst({
      where: { id },
      include: this.defaultInclude,
    });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }
    return serializeThread(thread);
  }

  async createThread(dto: CreateThreadDto): Promise<SafeMessageThread> {
    await this.ensureParticipantsExist(dto.participants.map((p) => p.userId));
    if (dto.listingId) {
      await this.ensureListingExists(dto.listingId);
    }

    if (dto.initialMessage) {
      const allowed = dto.participants.some((participant) => participant.userId === dto.initialMessage?.authorId);
      if (!allowed) {
        throw new BadRequestException('Initial message author must be a participant');
      }
    }

    const thread = await this.prisma.messageThread.create({
      data: {
        listingId: dto.listingId ?? null,
        subject: dto.subject ?? null,
        metadata: this.toJsonInput(dto.metadata),
      },
    });

    await this.prisma.messageThreadParticipant.createMany({
      data: dto.participants.map((participant) => ({
        threadId: thread.id,
        userId: participant.userId,
        role: participant.role,
      })),
    });

    if (dto.initialMessage) {
      await this.addMessage(thread.id, dto.initialMessage);
    }

    return this.getThread(thread.id);
  }

  async addMessage(id: string, dto: SendMessageDto, attachments: Express.Multer.File[] = []): Promise<SafeMessageThread> {
    const thread = await this.ensureThreadExists(id);
    await this.ensureParticipantInThread(id, dto.authorId);

    const storedAttachments = await this.persistUploadedAttachments(id, attachments);
    const moderationDecision = await this.moderation.scanMessage({
      threadId: id,
      authorId: dto.authorId,
      body: dto.body,
      attachments: storedAttachments.map((attachment) => ({
        url: attachment.url,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
      })),
    });

    const message = await this.prisma.message.create({
      data: {
        threadId: id,
        authorId: dto.authorId,
        body: dto.body,
        status: MessageStatus.SENT,
        metadata: this.toJsonInput(dto.metadata),
        moderationStatus: moderationDecision.status,
        moderationNotes: moderationDecision.notes ?? null,
        attachments: storedAttachments.length
          ? {
              create: storedAttachments.map((attachment) => ({
                bucket: attachment.bucket,
                storageKey: attachment.storageKey,
                url: attachment.url,
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
                fileSize: attachment.fileSize,
                metadata: this.toJsonInput(attachment.metadata),
              })),
            }
          : undefined,
        receipts: {
          create: thread.participants.map((participant) => ({
            userId: participant.userId,
            deliveredAt: participant.userId === dto.authorId ? new Date() : null,
            readAt: participant.userId === dto.authorId ? new Date() : null,
          })),
        },
      },
      include: { attachments: true, receipts: true },
    });

    await this.prisma.messageThread.update({ where: { id }, data: { updatedAt: new Date() } });

    const updatedThread = await this.getThread(id);
    if (moderationDecision.status === MessageModerationStatus.APPROVED) {
      await this.messagingGateway.emitNewMessage(updatedThread, message.id);
    }

    return updatedThread;
  }

  async markDelivered(messageId: string, userId: string): Promise<void> {
    await this.ensureReceiptExists(messageId, userId);
    const result = await this.prisma.messageDeliveryReceipt.updateMany({
      where: { messageId, userId, deliveredAt: null },
      data: { deliveredAt: new Date() },
    });
    if (result.count > 0) {
      await this.refreshMessageStatus(messageId);
    }
  }

  async markRead(messageId: string, userId: string): Promise<void> {
    await this.ensureReceiptExists(messageId, userId);
    const now = new Date();
    const result = await this.prisma.messageDeliveryReceipt.updateMany({
      where: { messageId, userId },
      data: { deliveredAt: now, readAt: now },
    });
    if (result.count > 0) {
      await this.refreshMessageStatus(messageId);
    }
  }

  private async ensureReceiptExists(messageId: string, userId: string): Promise<void> {
    const receipt = await this.prisma.messageDeliveryReceipt.findFirst({ where: { messageId, userId } });
    if (!receipt) {
      throw new NotFoundException('Receipt not found for this message and user');
    }
  }

  private async persistUploadedAttachments(
    threadId: string,
    files: Express.Multer.File[],
  ): Promise<AttachmentInput[]> {
    if (!files.length) {
      return [];
    }
    const results: AttachmentInput[] = [];
    for (const file of files) {
      const stored = await this.storageService.saveMessageAttachment(threadId, file);
      results.push({
        bucket: stored.bucket,
        storageKey: stored.key,
        url: stored.url,
        fileName: file.originalname,
        mimeType: file.mimetype ?? null,
        fileSize: file.size,
      });
    }
    return results;
  }

  private async refreshMessageStatus(messageId: string): Promise<void> {
    const receipts = await this.prisma.messageDeliveryReceipt.findMany({ where: { messageId } });
    if (!receipts.length) {
      return;
    }
    const allDelivered = receipts.every((receipt) => receipt.deliveredAt);
    const allRead = receipts.every((receipt) => receipt.readAt);
    const newStatus = allRead ? MessageStatus.READ : allDelivered ? MessageStatus.DELIVERED : MessageStatus.SENT;
    await this.prisma.message.update({ where: { id: messageId }, data: { status: newStatus } });
  }

  private async ensureParticipantsExist(userIds: string[]): Promise<void> {
    if (!userIds.length) {
      throw new NotFoundException('Participants are required');
    }
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds }, deletedAt: null } });
    if (users.length !== userIds.length) {
      throw new NotFoundException('One or more participants do not exist');
    }
  }

  private async ensureListingExists(listingId: string): Promise<void> {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, deletedAt: null } });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
  }

  private async ensureThreadExists(id: string): Promise<MessageThreadWithRelations> {
    const thread = await this.prisma.messageThread.findFirst({
      where: { id },
      include: this.defaultInclude,
    });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }
    return thread;
  }

  private async ensureParticipantInThread(threadId: string, userId: string): Promise<void> {
    const participant = await this.prisma.messageThreadParticipant.findFirst({
      where: { threadId, userId },
    });
    if (!participant) {
      throw new NotFoundException('User is not part of this conversation');
    }
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

  private get defaultInclude() {
    return {
      participants: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { attachments: true, receipts: true },
      },
    } satisfies Prisma.MessageThreadInclude;
  }

  private buildCacheKey(query: ThreadQueryDto): string {
    return `messages:threads:${JSON.stringify(query)}`;
  }

  private get cacheTtlMs() {
    const ttlSeconds = Number(this.configService.get<string>('CACHE_TTL_SECONDS') ?? 30);
    return (Number.isNaN(ttlSeconds) ? 30 : ttlSeconds) * 1000;
  }
}
