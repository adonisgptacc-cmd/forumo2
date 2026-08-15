'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

export const useAuctionSocket = (auctionId: string) => {
    const socketRef = useRef<Socket | null>(null);
    const { data: session } = useSession();
    const accessToken = (session as any)?.accessToken as string | undefined;

    useEffect(() => {
        // Only connect if we have an auctionId
        if (!auctionId) return;

        // Initialize socket connection
        // In dev, Next.js might effectively be on listing 3000, backend on 3001
        // Adjust URL as per env
        const socketUrl =
          process.env.NEXT_PUBLIC_WS_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          'http://localhost:4000';

        socketRef.current = io(`${socketUrl}/auctions`, {
            query: { auctionId },
            auth: { token: accessToken },
            transports: ['websocket'],
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('Connected to auction room:', auctionId);
        });

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [auctionId, accessToken]);

    return socketRef.current;
};
