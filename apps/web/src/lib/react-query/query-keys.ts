export const queryKeys = {
  listings: (params: Record<string, unknown>) => ['listings', params] as const,
  listing: (id: string) => ['listing', id] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['orders', id] as const,
  threads: (userId?: string | null) => ['threads', userId ?? 'self'] as const,
  thread: (id: string) => ['thread', id] as const,
};
