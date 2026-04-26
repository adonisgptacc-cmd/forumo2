'use client';

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SessionProvider } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CartProvider } from '../lib/cart-context';

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
          router.push(`/account-suspended?code=ACCOUNT_SUSPENDED${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`);
        } else if (code === 'ACCOUNT_BANNED') {
          const reason = err?.message ?? err?.response?.data?.message ?? '';
          router.push(`/account-suspended?code=ACCOUNT_BANNED${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`);
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
            {children}
          </CartProvider>
        </AccountSuspensionGuard>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SessionProvider>
  );
}
