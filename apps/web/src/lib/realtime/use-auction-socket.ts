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

  useEffect(() => {
    if (!auctionId) return;
    const base = getGatewayBaseUrl();
    const token = (session as unknown as { accessToken?: string })?.accessToken;
    const s = io(`${base}/auctions`, {
      query: { auctionId },
      auth: token ? { token } : {},
      transports: ["websocket"],
    });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [
    auctionId,
    (session as unknown as { accessToken?: string })?.accessToken,
  ]);

  return socket;
};
