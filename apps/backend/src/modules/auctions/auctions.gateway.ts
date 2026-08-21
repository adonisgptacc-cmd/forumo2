import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

@WebSocketGateway({ namespace: "/auctions", cors: { origin: "*" } })
export class AuctionsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server?: Server;

  private readonly logger = new Logger(AuctionsGateway.name);

  handleConnection(client: Socket): void {
    const auctionId = client.handshake.query.auctionId as string | undefined;
    if (auctionId) {
      client.join(auctionId);
      this.logger.debug(`Client connected to auction room: ${auctionId}`);
    }
  }

  handleDisconnect(client: Socket): void {
    // Standard cleanup if needed
  }

  emitBid(auctionId: string, bid: any): void {
    if (!this.server) return;
    this.server.to(auctionId).emit("auction:bid", bid);
  }

  emitAuctionEnd(auctionId: string, result: any): void {
    if (!this.server) return;
    this.server.to(auctionId).emit("auction:ended", result);
  }
}
