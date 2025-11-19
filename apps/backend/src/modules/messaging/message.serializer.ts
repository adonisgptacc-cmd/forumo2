import { Prisma } from '@prisma/client';

export type MessageThreadWithRelations = Prisma.MessageThreadGetPayload<{
  include: {
    participants: true;
    messages: { orderBy: { createdAt: 'asc' } };
  };
}>;

export type SafeMessageThread = MessageThreadWithRelations;

export const serializeThread = (thread: MessageThreadWithRelations): SafeMessageThread => thread;
