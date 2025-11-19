import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateThreadDto } from './dto/create-thread.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { ThreadQueryDto } from './dto/thread-query.dto.js';
import { MessageThreadWithRelations, SafeMessageThread, serializeThread } from './message.serializer.js';

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  async listThreads(query: ThreadQueryDto): Promise<SafeMessageThread[]> {
    const threads = await this.prisma.messageThread.findMany({
      where: {
        participants: query.userId ? { some: { userId: query.userId } } : undefined,
        listingId: query.listingId ?? undefined,
      },
      orderBy: { updatedAt: 'desc' },
      include: this.defaultInclude,
    });
    return threads.map((thread) => serializeThread(thread));
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
        participants: {
          create: dto.participants.map((participant) => ({
            userId: participant.userId,
            role: participant.role,
          })),
        },
        messages: dto.initialMessage
          ? {
              create: [
                {
                  authorId: dto.initialMessage.authorId,
                  body: dto.initialMessage.body,
                  attachments: this.toJsonInput(dto.initialMessage.attachments),
                  metadata: this.toJsonInput(dto.initialMessage.metadata),
                },
              ],
            }
          : undefined,
      },
      include: this.defaultInclude,
    });

    return serializeThread(thread);
  }

  async addMessage(id: string, dto: SendMessageDto): Promise<SafeMessageThread> {
    await this.ensureThreadExists(id);
    await this.ensureParticipantInThread(id, dto.authorId);

    const updated = await this.prisma.messageThread.update({
      where: { id },
      data: {
        messages: {
          create: {
            authorId: dto.authorId,
            body: dto.body,
            attachments: this.toJsonInput(dto.attachments),
            metadata: this.toJsonInput(dto.metadata),
          },
        },
      },
      include: this.defaultInclude,
    });

    return serializeThread(updated);
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

  private toJsonInput(value?: Record<string, unknown> | null): Prisma.InputJsonValue | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }

  private get defaultInclude() {
    return {
      participants: true,
      messages: { orderBy: { createdAt: 'asc' } },
    } satisfies Prisma.MessageThreadInclude;
  }
}
