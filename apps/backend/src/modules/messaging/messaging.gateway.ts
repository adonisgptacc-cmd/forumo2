import { Inject, forwardRef, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { SafeMessageThread } from "./message.serializer";
import { MessagingService } from "./messaging.service";

interface MessageAckPayload {
  messageId: string;
}

@WebSocketGateway({ namespace: '/messages', cors: { origin: '*' } })
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server?: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  private readonly clientUserIds = new Map<string, string>();

  constructor(
    @Inject(forwardRef(() => MessagingService))
    private readonly messagingService: MessagingService,
  ) {}

  handleConnection(client: Socket): void {
    const userId = this.extractUserId(client);
    if (!userId) {
      this.logger.warn('Socket connection rejected due to missing userId');
      client.disconnect(true);
      return;
    }
    this.clientUserIds.set(client.id, userId);
    client.join(userId);
    this.logger.debug(`User ${userId} connected to messaging gateway`);
  }

  handleDisconnect(client: Socket): void {
    const userId = this.clientUserIds.get(client.id);
    this.clientUserIds.delete(client.id);
    if (userId) {
      this.logger.debug(`User ${userId} disconnected from messaging gateway`);
    }
  }

  async emitNewMessage(thread: SafeMessageThread, messageId?: string): Promise<void> {
    if (!this.server) {
      return;
    }
    const latestMessage = messageId
      ? thread.messages.find((message) => message.id === messageId)
      : thread.messages.at(-1);
    if (!latestMessage) {
      return;
    }
    thread.participants.forEach((participant) => {
      this.server?.to(participant.userId).emit('messages:new', {
        threadId: thread.id,
        message: latestMessage,
      });
    });
  }

  @SubscribeMessage('messages:delivered')
  async handleDelivered(@ConnectedSocket() client: Socket, @MessageBody() payload: MessageAckPayload): Promise<void> {
    const userId = this.clientUserIds.get(client.id);
    if (!userId || !payload?.messageId) {
      return;
    }
    await this.messagingService.markDelivered(payload.messageId, userId);
  }

  @SubscribeMessage('messages:read')
  async handleRead(@ConnectedSocket() client: Socket, @MessageBody() payload: MessageAckPayload): Promise<void> {
    const userId = this.clientUserIds.get(client.id);
    if (!userId || !payload?.messageId) {
      return;
    }
    await this.messagingService.markRead(payload.messageId, userId);
  }

  private extractUserId(client: Socket): string | null {
    const authUser = typeof client.handshake.auth?.userId === 'string' ? client.handshake.auth.userId : undefined;
    const queryUser = typeof client.handshake.query.userId === 'string' ? (client.handshake.query.userId as string) : undefined;
    return authUser ?? queryUser ?? null;
  }
}
