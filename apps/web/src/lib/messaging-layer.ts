import { io, type Socket } from 'socket.io-client';

import type { CreateThreadDto, SafeMessageThread, SendMessageDto } from '@forumo/shared';

import { apiBaseUrl, createApiClient } from './api-client';

export class MessagingLayer {
  private readonly apiClient: ReturnType<typeof createApiClient>;

  constructor(accessToken?: string | null) {
    this.apiClient = createApiClient(accessToken);
  }

  connect(userId: string): Socket {
    const base = getGatewayBaseUrl();
    return io(`${base}/messages`, { auth: { userId } });
  }

  async listThreads(params: { userId?: string; listingId?: string } = {}): Promise<SafeMessageThread[]> {
    return this.apiClient.messaging.listThreads(params);
  }

  async getThread(id: string): Promise<SafeMessageThread> {
    return this.apiClient.messaging.getThread(id);
  }

  async createThread(payload: CreateThreadDto): Promise<SafeMessageThread> {
    return this.apiClient.messaging.createThread(payload);
  }

  async sendMessage(
    threadId: string,
    payload: SendMessageDto,
    attachments?: Blob[],
  ): Promise<SafeMessageThread> {
    return this.apiClient.messaging.sendMessage(threadId, payload, attachments);
  }

  emitDelivered(socket: Socket | null, messageId: string) {
    socket?.emit('messages:delivered', { messageId });
  }

  emitRead(socket: Socket | null, messageId: string) {
    socket?.emit('messages:read', { messageId });
  }
}

export function getGatewayBaseUrl() {
  return (apiBaseUrl ?? '').replace(/\/api\/v1$/, '');
}

