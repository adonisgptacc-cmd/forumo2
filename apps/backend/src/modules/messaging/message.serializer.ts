import { Prisma } from '@prisma/client';

export type MessageWithRelations = Prisma.MessageGetPayload<{
  include: {
    attachments: true;
    receipts: true;
  };
}>;

export type MessageThreadWithRelations = Prisma.MessageThreadGetPayload<{
  include: {
    participants: true;
    messages: {
      orderBy: { createdAt: 'asc' };
      include: { attachments: true; receipts: true };
    };
  };
}>;

export type SafeMessageThread = MessageThreadWithRelations;

export const serializeThread = (thread: MessageThreadWithRelations): SafeMessageThread => thread;
