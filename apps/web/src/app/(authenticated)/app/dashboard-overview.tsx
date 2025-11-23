'use client';

import Link from 'next/link';

import { useListings, useMessageThreads, useOrders } from '../../../lib/react-query/hooks';

export function DashboardOverview() {
  const { data: listings } = useListings({ page: 1, pageSize: 5 });
  const { data: orders } = useOrders();
  const { data: threads } = useMessageThreads(undefined, 1);

  const threadList = threads?.data ?? [];

  const openOrders = orders?.filter((order) => order.status !== 'COMPLETED' && order.status !== 'CANCELLED') ?? [];
  const unreadMessages =
    threadList.reduce((total, thread) => {
      return (
        total +
        thread.messages.filter((message) => message.receipts?.every((receipt) => !receipt.readAt)).length
      );
    }, 0) ?? 0;

  return (
    <div className="grid gap-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Active listings" value={listings?.data.length ?? 0} hint="Showing last 5" />
        <StatCard label="Open orders" value={openOrders.length} hint="Across escrow + shipping" />
        <StatCard label="Unread messages" value={unreadMessages} hint="Awaiting response" />
      </section>

      <section className="grid-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent listings</h2>
          <Link className="text-sm text-amber-300" href="/listings">
            Manage inventory →
          </Link>
        </div>
        <ul className="space-y-3 text-sm">
          {listings?.data.map((listing) => (
            <li key={listing.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{listing.title}</p>
                <p className="text-xs text-slate-500">{listing.status}</p>
              </div>
              <span className="text-slate-300">{formatPrice(listing.priceCents, listing.currency ?? 'USD')}</span>
            </li>
          )) ?? <p className="text-slate-500">No listings yet.</p>}
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="grid-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Orders in escrow</h2>
            <Link className="text-sm text-amber-300" href="/app/orders">
              View workflow →
            </Link>
          </div>
          <ul className="space-y-3 text-sm">
            {openOrders.slice(0, 4).map((order) => (
              <li key={order.id} className="rounded-lg border border-slate-800 p-3">
                <p className="font-semibold">{order.orderNumber}</p>
                <p className="text-xs text-slate-500">{order.status} · {order.currency} {(order.totalItemCents + order.shippingCents) / 100}</p>
              </li>
            ))}
            {openOrders.length === 0 ? <p className="text-slate-500">No pending orders.</p> : null}
          </ul>
        </div>
        <div className="grid-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Latest messages</h2>
            <Link className="text-sm text-amber-300" href="/app/messages">
              Open inbox →
            </Link>
          </div>
          <ul className="space-y-3 text-sm">
            {threadList.slice(0, 4).map((thread) => {
              const lastMessage = thread.messages.at(-1);
              return (
                <li key={thread.id} className="rounded-lg border border-slate-800 p-3">
                  <p className="font-semibold">{thread.subject ?? 'Conversation'}</p>
                  <p className="text-xs text-slate-500">{lastMessage?.body ?? 'No messages yet.'}</p>
                </li>
              );
            }) ?? <p className="text-slate-500">No conversations.</p>}
          </ul>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="grid-card space-y-1">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className="text-3xl font-semibold">{value}</p>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(priceCents / 100);
}
