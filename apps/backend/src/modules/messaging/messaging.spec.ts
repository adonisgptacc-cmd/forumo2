import type { Express } from 'express';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MessageModerationStatus, MessageParticipantRole, MessageStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { MessagingModule } from "./messaging.module";
import { MessagingGateway } from "./messaging.gateway";
import { MessageModerationService } from "./moderation.service";
import { MessagingService } from "./messaging.service";

const BUYER_ID = 'buyer-1';
const SELLER_ID = 'seller-1';

describe('MessagingModule (integration)', () => {
  let app: INestApplication;
  let prisma: InMemoryPrismaService;
  let gateway: MessagingGateway;
  let server: RecordingServer;
  let moderation: MockModerationService;
  let storage: FakeStorageService;
  let messagingService: MessagingService;
  let threadId: string;

  beforeEach(async () => {
    prisma = new InMemoryPrismaService();
    server = new RecordingServer();
    moderation = new MockModerationService();
    storage = new FakeStorageService();

    const moduleRef = await Test.createTestingModule({
      imports: [MessagingModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(MessageModerationService)
      .useValue(moderation)
      .overrideProvider(StorageService)
      .useValue(storage)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    gateway = moduleRef.get(MessagingGateway);
    gateway.server = server as any;
    messagingService = moduleRef.get(MessagingService);

    const createThreadRes = await request(app.getHttpServer())
      .post('/messages/threads')
      .send({
        subject: 'Order Q&A',
        participants: [
          { userId: BUYER_ID, role: MessageParticipantRole.BUYER },
          { userId: SELLER_ID, role: MessageParticipantRole.SELLER },
        ],
      })
      .expect(201);
    threadId = createThreadRes.body.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('streams attachments, persists metadata, and emits realtime payloads', async () => {
    const response = await request(app.getHttpServer())
      .post(`/messages/threads/${threadId}/messages`)
      .field('authorId', BUYER_ID)
      .field('body', 'Product photo attached')
      .attach('attachments', Buffer.from('file-bytes'), { filename: 'photo.png', contentType: 'image/png' })
      .expect(201);

    const latestMessage = response.body.messages.at(-1);
    expect(latestMessage.attachments).toHaveLength(1);
    expect(latestMessage.attachments[0].fileName).toBe('photo.png');
    expect(storage.savedAttachments).toHaveLength(1);
    expect(server.events).toHaveLength(2);
    expect(server.events[0]).toMatchObject({ room: BUYER_ID, payload: expect.objectContaining({ threadId }) });
    expect(server.events[1]).toMatchObject({ room: SELLER_ID, payload: expect.objectContaining({ threadId }) });
  });

  it('tracks delivery and read receipts for participants', async () => {
    const response = await request(app.getHttpServer())
      .post(`/messages/threads/${threadId}/messages`)
      .field('authorId', BUYER_ID)
      .field('body', 'Package shipped?')
      .expect(201);

    const messageId = response.body.messages.at(-1).id;
    await messagingService.markDelivered(messageId, SELLER_ID);
    await messagingService.markRead(messageId, SELLER_ID);

    const threadRes = await request(app.getHttpServer()).get(`/messages/threads/${threadId}`).expect(200);
    const updatedMessage = threadRes.body.messages.find((message: any) => message.id === messageId);
    expect(updatedMessage.status).toBe(MessageStatus.READ);
    const sellerReceipt = updatedMessage.receipts.find((receipt: any) => receipt.userId === SELLER_ID);
    expect(sellerReceipt.readAt).toBeTruthy();
  });

  it('updates delivery state when gateway receives delivered/read events', async () => {
    const response = await request(app.getHttpServer())
      .post(`/messages/threads/${threadId}/messages`)
      .field('authorId', BUYER_ID)
      .field('body', 'Confirming delivery window')
      .expect(201);

    const messageId = response.body.messages.at(-1).id as string;
    const socket = new FakeSocket(SELLER_ID);
    gateway.handleConnection(socket as any);

    await gateway.handleDelivered(socket as any, { messageId });
    await gateway.handleRead(socket as any, { messageId });

    const threadRes = await request(app.getHttpServer()).get(`/messages/threads/${threadId}`).expect(200);
    const updatedMessage = threadRes.body.messages.find((message: any) => message.id === messageId);
    expect(updatedMessage.status).toBe(MessageStatus.READ);
    const receipt = updatedMessage.receipts.find((item: any) => item.userId === SELLER_ID);
    expect(receipt.deliveredAt).toBeTruthy();
    expect(receipt.readAt).toBeTruthy();
  });

  it('flags risky content and holds delivery when moderation rejects', async () => {
    moderation.status = MessageModerationStatus.FLAGGED;
    moderation.notes = 'Contains sensitive information';

    const response = await request(app.getHttpServer())
      .post(`/messages/threads/${threadId}/messages`)
      .field('authorId', BUYER_ID)
      .field('body', 'spam link here')
      .expect(201);

    const latestMessage = response.body.messages.at(-1);
    expect(latestMessage.moderationStatus).toBe(MessageModerationStatus.FLAGGED);
    expect(server.events).toHaveLength(0);
  });
});

class MockModerationService {
  status: MessageModerationStatus = MessageModerationStatus.APPROVED;
  notes: string | null = null;

  async scanMessage() {
    return { status: this.status, notes: this.notes };
  }
}

class RecordingServer {
  events: Array<{ room: string; payload: any }> = [];

  to(room: string) {
    return {
      emit: (event: string, payload: any) => {
        if (event === 'messages:new') {
          this.events.push({ room, payload });
        }
      },
    };
  }
}

class FakeSocket {
  id = randomUUID();
  handshake: { auth: { userId: string }; query: Record<string, unknown> };

  constructor(userId: string) {
    this.handshake = { auth: { userId }, query: {} };
  }

  join() {
    return;
  }
}

class FakeStorageService {
  savedAttachments: Array<{ threadId: string; filename: string }> = [];

  async saveMessageAttachment(threadId: string, file: Express.Multer.File) {
    this.savedAttachments.push({ threadId, filename: file.originalname });
    return { bucket: 'test', key: `${threadId}/${file.originalname}`, url: `s3://test/${threadId}/${file.originalname}` };
  }

  async saveListingImage(listingId: string, file: Express.Multer.File) {
    return { bucket: 'test', key: `listings/${listingId}/${file.originalname}`, url: `s3://test/${listingId}/${file.originalname}` };
  }
}

interface ThreadRecord {
  id: string;
  listingId: string | null;
  subject: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ParticipantRecord {
  id: string;
  threadId: string;
  userId: string;
  role: MessageParticipantRole;
  joinedAt: Date;
}

interface MessageRecord {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  status: MessageStatus;
  moderationStatus: MessageModerationStatus;
  moderationNotes: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AttachmentRecord {
  id: string;
  messageId: string;
  bucket: string;
  storageKey: string;
  url: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

interface ReceiptRecord {
  id: string;
  messageId: string;
  userId: string;
  deliveredAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
}

class InMemoryPrismaService {
  private users = new Map<string, { id: string; deletedAt: Date | null }>([
    [BUYER_ID, { id: BUYER_ID, deletedAt: null }],
    [SELLER_ID, { id: SELLER_ID, deletedAt: null }],
  ]);
  private threads = new Map<string, ThreadRecord>();
  private participants = new Map<string, ParticipantRecord>();
  private messages = new Map<string, MessageRecord>();
  private attachments = new Map<string, AttachmentRecord>();
  private receipts = new Map<string, ReceiptRecord>();

  user = {
    findMany: async ({ where }: { where: { id: { in: string[] }; deletedAt: null } }) => {
      return where.id.in
        .map((id) => this.users.get(id))
        .filter((user): user is { id: string; deletedAt: null } => Boolean(user && user.deletedAt === null));
    },
  };

  listing = {
    findFirst: async () => null,
  };

  messageThread = {
    findMany: async ({ where, include, orderBy }: any) => {
      let results = Array.from(this.threads.values());
      if (where?.listingId) {
        results = results.filter((thread) => thread.listingId === where.listingId);
      }
      if (where?.participants?.some?.userId) {
        results = results.filter((thread) =>
          Array.from(this.participants.values()).some(
            (participant) => participant.threadId === thread.id && participant.userId === where.participants.some.userId,
          ),
        );
      }
      if (orderBy?.updatedAt === 'desc') {
        results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      }
      return results.map((thread) => this.buildThread(thread, include));
    },
    findFirst: async ({ where, include }: any) => {
      const match = Array.from(this.threads.values()).find((thread) => {
        if (where?.id && thread.id !== where.id) {
          return false;
        }
        return true;
      });
      if (!match) {
        return null;
      }
      return this.buildThread(match, include);
    },
    create: async ({ data }: { data: Partial<ThreadRecord> }) => {
      const now = new Date();
      const record: ThreadRecord = {
        id: data.id ?? randomUUID(),
        listingId: (data.listingId ?? null) as string | null,
        subject: (data.subject ?? null) as string | null,
        metadata: (data.metadata ?? null) as Record<string, unknown> | null,
        createdAt: now,
        updatedAt: now,
      };
      this.threads.set(record.id, record);
      return { ...record };
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<ThreadRecord> }) => {
      const thread = this.threads.get(where.id);
      if (!thread) {
        throw new Error('Thread not found');
      }
      Object.assign(thread, data);
      thread.updatedAt = data.updatedAt ?? new Date();
      return this.buildThread(thread, undefined);
    },
  };

  messageThreadParticipant = {
    createMany: async ({ data }: { data: Array<{ threadId: string; userId: string; role: MessageParticipantRole }> }) => {
      data.forEach((participant) => {
        const record: ParticipantRecord = {
          id: randomUUID(),
          threadId: participant.threadId,
          userId: participant.userId,
          role: participant.role,
          joinedAt: new Date(),
        };
        this.participants.set(`${record.threadId}-${record.userId}`, record);
      });
      return { count: data.length };
    },
    findFirst: async ({ where }: { where: { threadId: string; userId: string } }) => {
      return this.participants.get(`${where.threadId}-${where.userId}`) ?? null;
    },
  };

  message = {
    create: async ({ data, include }: any) => {
      const now = new Date();
      const record: MessageRecord = {
        id: randomUUID(),
        threadId: data.threadId,
        authorId: data.authorId,
        body: data.body,
        status: data.status ?? MessageStatus.SENT,
        moderationStatus: data.moderationStatus ?? MessageModerationStatus.PENDING,
        moderationNotes: data.moderationNotes ?? null,
        metadata: (data.metadata ?? null) as Record<string, unknown> | null,
        createdAt: now,
        updatedAt: now,
      };
      this.messages.set(record.id, record);

      data.attachments?.create?.forEach((attachment: any) => {
        const attachmentRecord: AttachmentRecord = {
          id: randomUUID(),
          messageId: record.id,
          bucket: attachment.bucket,
          storageKey: attachment.storageKey,
          url: attachment.url,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType ?? null,
          fileSize: attachment.fileSize ?? null,
          metadata: (attachment.metadata ?? null) as Record<string, unknown> | null,
          createdAt: now,
        };
        this.attachments.set(attachmentRecord.id, attachmentRecord);
      });

      data.receipts?.create?.forEach((receipt: any) => {
        const receiptRecord: ReceiptRecord = {
          id: randomUUID(),
          messageId: record.id,
          userId: receipt.userId,
          deliveredAt: receipt.deliveredAt ?? null,
          readAt: receipt.readAt ?? null,
          createdAt: now,
        };
        this.receipts.set(`${receiptRecord.messageId}-${receiptRecord.userId}`, receiptRecord);
      });

      return include ? this.buildMessage(record, include) : { ...record };
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<MessageRecord> }) => {
      const message = this.messages.get(where.id);
      if (!message) {
        throw new Error('Message not found');
      }
      Object.assign(message, data);
      message.updatedAt = new Date();
      return { ...message };
    },
  };

  messageDeliveryReceipt = {
    findFirst: async ({ where }: { where: { messageId: string; userId: string } }) => {
      return this.receipts.get(`${where.messageId}-${where.userId}`) ?? null;
    },
    findMany: async ({ where }: { where: { messageId: string } }) => {
      return Array.from(this.receipts.values()).filter((receipt) => receipt.messageId === where.messageId);
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const receipt of this.receipts.values()) {
        if (receipt.messageId !== where.messageId || receipt.userId !== where.userId) {
          continue;
        }
        if (where.deliveredAt === null && receipt.deliveredAt !== null) {
          continue;
        }
        Object.assign(receipt, data);
        count += 1;
      }
      return { count };
    },
  };

  private buildThread(thread: ThreadRecord, include?: any) {
    const participants = include?.participants
      ? Array.from(this.participants.values())
          .filter((participant) => participant.threadId === thread.id)
          .map((participant) => ({ ...participant }))
      : undefined;
    const messages = include?.messages
      ? this.buildMessagesForThread(thread.id, include.messages?.orderBy?.createdAt)
      : undefined;
    return {
      ...thread,
      participants: participants ?? [],
      messages: messages ?? [],
    };
  }

  private buildMessagesForThread(threadId: string, orderBy?: 'asc' | 'desc') {
    const messages = Array.from(this.messages.values())
      .filter((message) => message.threadId === threadId)
      .map((message) => this.buildMessage(message, { attachments: true, receipts: true }));
    messages.sort((a, b) =>
      orderBy === 'desc' ? b.createdAt.getTime() - a.createdAt.getTime() : a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return messages;
  }

  private buildMessage(message: MessageRecord, include?: any) {
    const attachments = include?.attachments
      ? Array.from(this.attachments.values())
          .filter((attachment) => attachment.messageId === message.id)
          .map((attachment) => ({ ...attachment }))
      : undefined;
    const receipts = include?.receipts
      ? Array.from(this.receipts.values())
          .filter((receipt) => receipt.messageId === message.id)
          .map((receipt) => ({ ...receipt }))
      : undefined;
    return {
      ...message,
      attachments: attachments ?? [],
      receipts: receipts ?? [],
    };
  }
}
