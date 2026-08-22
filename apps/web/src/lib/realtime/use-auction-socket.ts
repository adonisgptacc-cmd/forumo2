"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { getGatewayBaseUrl } from "@forumo/shared";

export const useAuctionSocket = (auctionId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { data: session } = useSession() as unknown as {
    accessToken?: string;
  } & Record<string, unknown>;
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    if (!auctionId) return;
    const base = getGatewayBaseUrl();
    const s = io(`${base}/auctions`, {
      query: { auctionId },
      auth: accessToken ? { token: accessToken } : {},
      transports: ["websocket"],
    });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [accessToken, auctionId]);

  return socket;
};
