'use client';

import Link from 'next/link';

import { useListings, useMessageThreads, useOrders, useCurrentUser, useBecomeSeller } from '../../../lib/react-query/hooks';

export function DashboardOverview() {
  const { user } = useCurrentUser();
  const becomeSeller = useBecomeSeller();
  const { data: listings, isLoading: listingsLoading } = useListings({ page: 1, pageSize: 5 });
  const { data: orders, isLoading: ordersLoading } = useOrders();
  const { data: threads, isLoading: threadsLoading } = useMessageThreads(undefined, 1);

  const threadList = threads?.data ?? [];
  const openOrders = orders?.filter((order) => order.status !== 'COMPLETED' && order.status !== 'CANCELLED') ?? [];
  const unreadMessages = threadList.reduce((total, thread) => {
    return total + thread.messages.filter((message) => message.receipts?.every((receipt) => !receipt.readAt)).length;
  }, 0);

  const statsLoading = listingsLoading || ordersLoading || threadsLoading;

  return (
    <div className="grid gap-6">
      {/* Become a Seller banner — only shown to BUYER accounts */}
      {user?.role === 'BUYER' && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-amber-800">Ready to sell on Forumo?</p>
            <p className="text-sm muted mt-0.5">Upgrade your account to list items, receive payments, and manage orders.</p>
          </div>
          <button
            onClick={() => becomeSeller.mutate()}
            disabled={becomeSeller.isPending || becomeSeller.isSuccess}
            className="btn btn-primary btn-sm shrink-0"
          >
            {becomeSeller.isPending ? 'Activating…' : becomeSeller.isSuccess ? 'Activated!' : 'Become a Seller'}
          </button>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Active listings" value={listings?.data.length ?? 0} hint="Showing last 5" />
            <StatCard label="Open orders" value={openOrders.length} hint="Across escrow + shipping" />
            <StatCard label="Unread messages" value={unreadMessages} hint="Awaiting response" />
          </>
        )}
      </section>

      <section className="card card-pad space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent listings</h2>
          <Link className="text-sm text-[color:var(--accent)] hover:underline" href="/listings">
            Manage inventory →
          </Link>
        </div>
        {listingsLoading ? (
          <ListSkeleton rows={3} />
        ) : listings?.data.length ? (
          <ul className="space-y-3 text-sm">
            {listings.data.map((listing) => (
              <li key={listing.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{listing.title}</p>
                  <p className="text-xs muted">{listing.status}</p>
                </div>
                <span className="subtle">{formatPrice(listing.priceCents, listing.currency ?? 'USD')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted text-sm">No listings yet.</p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card card-pad space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Orders in escrow</h2>
            <Link className="text-sm text-[color:var(--accent)] hover:underline" href="/app/orders">
              View workflow →
            </Link>
          </div>
          {ordersLoading ? (
            <ListSkeleton rows={3} />
          ) : openOrders.length ? (
            <ul className="space-y-3 text-sm">
              {openOrders.slice(0, 4).map((order) => (
                <li key={order.id} className="rounded-lg border border-[color:var(--line)] p-3">
                  <p className="font-semibold">{order.orderNumber}</p>
                  <p className="text-xs muted">
                    {order.status} · {order.currency} {(order.totalItemCents + order.shippingCents) / 100}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted text-sm">No pending orders.</p>
          )}
        </div>

        <div className="card card-pad space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Latest messages</h2>
            <Link className="text-sm text-[color:var(--accent)] hover:underline" href="/app/messages">
              Open inbox →
            </Link>
          </div>
          {threadsLoading ? (
            <ListSkeleton rows={3} />
          ) : threadList.length ? (
            <ul className="space-y-3 text-sm">
              {threadList.slice(0, 4).map((thread) => {
                const lastMessage = thread.messages.at(-1);
                return (
                  <li key={thread.id} className="rounded-lg border border-[color:var(--line)] p-3">
                    <p className="font-semibold">{thread.subject ?? 'Conversation'}</p>
                    <p className="text-xs muted">{lastMessage?.body ?? 'No messages yet.'}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted text-sm">No conversations yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card card-pad space-y-1">
      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-3)]">{label}</p>
      <p className="text-3xl font-semibold">{value}</p>
      {hint ? <p className="text-xs muted">{hint}</p> : null}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="card card-pad space-y-2">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton h-9 w-12" />
      <div className="skeleton h-3 w-32" />
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="skeleton h-3.5 w-32" />
            <div className="skeleton h-3 w-20" />
          </div>
          <div className="skeleton h-3.5 w-16" />
        </li>
      ))}
    </ul>
  );
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(priceCents / 100);
}
