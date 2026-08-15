import { Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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
import { PrismaService } from '../../prisma/prisma.service';

interface MessageAckPayload {
  messageId: string;
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

// Rate limit: max messages per user per window
const WS_MESSAGE_LIMIT = 20;
const WS_MESSAGE_WINDOW_MS = 10_000;

@WebSocketGateway({
  namespace: '/messages',
  cors: { origin: allowedOrigins, credentials: true },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server?: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  private readonly clientUserIds = new Map<string, string>();
  /** userId → { count, windowStart } for outbound message rate limiting */
  private readonly messageCounts = new Map<string, { count: number; windowStart: number }>();

  constructor(
    @Inject(forwardRef(() => MessagingService))
    private readonly messagingService: MessagingService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) { }

  async handleConnection(client: Socket): Promise<void> {
    const userId = await this.verifyAndExtractUserId(client);
    if (!userId) {
      this.logger.warn(`Socket connection rejected — invalid or missing JWT (id=${client.id})`);
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
    if (!this.isWithinMessageRateLimit(userId)) {
      client.emit('error', { message: 'Rate limit exceeded. Slow down.' });
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
    if (!this.isWithinMessageRateLimit(userId)) {
      client.emit('error', { message: 'Rate limit exceeded. Slow down.' });
      return;
    }
    await this.messagingService.markRead(payload.messageId, userId);
  }

  /** Verifies the JWT from the handshake and returns the confirmed userId, or null on failure. */
  private async verifyAndExtractUserId(client: Socket): Promise<string | null> {
    const token = this.extractToken(client);
    if (!token) return null;
    try {
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      const payload = this.jwtService.verify<{ sub: string; tokenVersion: number }>(token, { secret });
      if (!payload?.sub) return null;
      // Verify tokenVersion matches the database to reject revoked tokens
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { tokenVersion: true },
      });
      if (!user || user.tokenVersion !== payload.tokenVersion) return null;
      return payload.sub;
    } catch {
      return null;
    }
  }

  /** Extracts the raw Bearer token from Authorization header or socket auth object. */
  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) return authToken;
    return null;
  }

  /** Returns true if the user is within the outbound message rate limit. */
  private isWithinMessageRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = this.messageCounts.get(userId);
    if (!entry || now - entry.windowStart > WS_MESSAGE_WINDOW_MS) {
      this.messageCounts.set(userId, { count: 1, windowStart: now });
      return true;
    }
    if (entry.count >= WS_MESSAGE_LIMIT) {
      return false;
    }
    entry.count += 1;
    return true;
  }
}
