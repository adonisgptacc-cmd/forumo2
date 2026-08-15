'use client';

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SessionProvider, useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { CartProvider } from '../lib/cart-context';
import { getGatewayBaseUrl } from '../lib/messaging-layer';
import { queryKeys } from '../lib/react-query/query-keys';
import type { SafeNotification } from '@forumo/shared';

// ── Notification WebSocket sync ────────────────────────────────────────────────
// Connects to the NestJS notifications gateway and pushes incoming events into
// the React Query cache. Falls back gracefully to the existing polling interval
// if the socket cannot connect within 5 seconds.

const CONNECT_TIMEOUT_MS = 5_000;

function NotificationsSocketSync() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;
  const accessToken = (session as any)?.accessToken as string | undefined;
  const client = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId || !accessToken) return;

    const base = getGatewayBaseUrl();
    const socket = io(`${base}/notifications`, {
      auth: { token: accessToken },
      reconnectionAttempts: 5,
      timeout: CONNECT_TIMEOUT_MS,
    });
    socketRef.current = socket;

    // If the socket fails to connect within the timeout, we do nothing extra —
    // the existing refetchInterval on useNotifications/useUnreadCount handles polling.
    fallbackTimerRef.current = setTimeout(() => {
      if (!socket.connected) {
        socket.disconnect();
      }
    }, CONNECT_TIMEOUT_MS);

    socket.on('connect', () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      socket.emit('subscribe', { userId });
    });

    socket.on('notification', (notification: SafeNotification) => {
      // Prepend to notifications list
      client.setQueryData<SafeNotification[]>(queryKeys.notifications, (prev) =>
        prev ? [notification, ...prev] : [notification],
      );
      // Increment unread count
      client.setQueryData<{ count: number }>(queryKeys.notificationUnreadCount, (prev) => ({
        count: (prev?.count ?? 0) + 1,
      }));
    });

    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, accessToken, client]);

  return null;
}

function AccountSuspensionGuard({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.state.status === 'error') {
        const err = event.query.state.error as any;
        const code = err?.code ?? err?.response?.data?.code ?? err?.body?.code;
        if (code === 'ACCOUNT_SUSPENDED') {
          const reason = err?.message ?? err?.response?.data?.message ?? '';
          router.push((`/account-suspended?code=ACCOUNT_SUSPENDED${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`) as any);
        } else if (code === 'ACCOUNT_BANNED') {
          const reason = err?.message ?? err?.response?.data?.message ?? '';
          router.push((`/account-suspended?code=ACCOUNT_BANNED${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`) as any);
        }
      }
    });
    return unsubscribe;
  }, [queryClient, router]);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={client}>
        <AccountSuspensionGuard>
          <CartProvider>
            <NotificationsSocketSync />
            {children}
          </CartProvider>
        </AccountSuspensionGuard>
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </SessionProvider>
  );
}
