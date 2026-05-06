'use client';

import Link from 'next/link';
import { useOrders, useListings, useOffers, useCurrentUser, useSellerAnalytics } from '../../../../lib/react-query/hooks';
import type { SafeOrder } from '@forumo/shared';

function formatCurrency(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export function SellerDashboard() {
  const { user } = useCurrentUser();
  const { data: orders = [], isLoading: ordersLoading } = useOrders();
  const { data: listings, isLoading: listingsLoading } = useListings({ page: 1, pageSize: 50 });
  const { data: offers = [], isLoading: offersLoading } = useOffers();
  const { data: analytics, isLoading: analyticsLoading } = useSellerAnalytics();

  const isLoading = ordersLoading || listingsLoading || offersLoading || analyticsLoading;

  // Revenue: sum of completed orders where I'm the seller
  const myOrders = orders.filter((o) => o.sellerId === user?.id);
  const completedOrders = myOrders.filter((o) => o.status === 'COMPLETED');
  const pendingOrders = myOrders.filter((o) => o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'PAID');
  const shippedOrders = myOrders.filter((o) => o.status === 'FULFILLED');

  // Prefer server-side analytics for accuracy, fall back to client-computed
  const totalRevenueCents = analytics?.totalRevenueCents ?? completedOrders.reduce((sum, o) => sum + o.totalItemCents, 0);
  const pendingRevenueCents = pendingOrders.reduce((sum, o) => sum + o.totalItemCents, 0);
  const currency = completedOrders[0]?.currency ?? pendingOrders[0]?.currency ?? 'USD';

  // Offers
  const receivedOffers = offers.filter((o) => o.sellerId === user?.id);
  const pendingOffers = receivedOffers.filter((o) => o.status === 'PENDING');

  // Top listings by total order value
  const listingRevenue: Record<string, { title: string; revenue: number; count: number }> = {};
  completedOrders.forEach((order) => {
    order.items.forEach((item) => {
      if (!listingRevenue[item.listingId]) {
        listingRevenue[item.listingId] = { title: item.listingTitle, revenue: 0, count: 0 };
      }
      listingRevenue[item.listingId].revenue += item.unitPriceCents * item.quantity;
      listingRevenue[item.listingId].count += item.quantity;
    });
  });
  const topListings = Object.entries(listingRevenue)
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-2">
              <div className="h-3 w-24 rounded bg-slate-700" />
              <div className="h-7 w-20 rounded bg-slate-700" />
              <div className="h-3 w-28 rounded bg-slate-700" />
            </div>
          ))}
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Revenue stats */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatCurrency(totalRevenueCents, currency)}
          sub={`${completedOrders.length} completed orders`}
          color="text-emerald-400"
        />
        <StatCard
          label="Pending revenue"
          value={formatCurrency(pendingRevenueCents, currency)}
          sub={`${pendingOrders.length} orders in progress`}
          color="text-yellow-400"
        />
        <StatCard
          label="Shipped"
          value={String(shippedOrders.length)}
          sub="fulfilled, awaiting delivery"
          color="text-blue-400"
        />
        <StatCard
          label="Pending offers"
          value={String(pendingOffers.length)}
          sub={`${receivedOffers.length} total received`}
          color="text-amber-400"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent orders */}
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Recent orders</h3>
            <Link href={"/app/orders" as any} className="text-xs text-amber-400 hover:underline">
              All orders →
            </Link>
          </div>
          {myOrders.length === 0 ? (
            <p className="text-sm text-slate-500">No orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {myOrders.slice(0, 6).map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/app/orders/${order.id}` as any}
                    className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 hover:border-amber-500/30"
                  >
                    <div>
                      <p className="text-sm font-medium">{order.orderNumber}</p>
                      <p className="text-xs text-slate-500">
                        {order.status} · {order.placedAt ? timeAgo(order.placedAt) : ''}
                      </p>
                    </div>
                    <span className="text-sm text-slate-300">
                      {formatCurrency(order.totalItemCents, order.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Returns needing response */}
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Return requests</h3>
            <Link href={"/app/dashboard/returns" as any} className="text-xs text-amber-400 hover:underline">
              Manage returns →
            </Link>
          </div>
          <p className="text-sm text-slate-500">
            Review and respond to buyer return requests.
          </p>
        </section>

        {/* Pending offers */}
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Offers to review</h3>
            <Link href={"/app/offers" as any} className="text-xs text-amber-400 hover:underline">
              All offers →
            </Link>
          </div>
          {pendingOffers.length === 0 ? (
            <p className="text-sm text-slate-500">No pending offers.</p>
          ) : (
            <ul className="space-y-2">
              {pendingOffers.slice(0, 5).map((offer) => (
                <li key={offer.id} className="rounded-lg border border-amber-700/40 bg-amber-900/10 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{offer.listing?.title ?? 'Listing'}</p>
                      <p className="text-xs text-slate-500">
                        From {offer.buyer?.name ?? 'Buyer'} · {timeAgo(offer.createdAt)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-amber-400">
                      {formatCurrency(offer.amountCents, offer.currency)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Revenue by month */}
        {analytics && analytics.revenueByMonth.some((m) => m.revenueCents > 0) && (
          <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3 lg:col-span-2">
            <h3 className="font-semibold">Revenue — last 12 months</h3>
            <div className="flex items-end gap-1 h-24">
              {(() => {
                const max = Math.max(...analytics.revenueByMonth.map((m) => m.revenueCents), 1);
                return analytics.revenueByMonth.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm bg-amber-500/60 hover:bg-amber-400/80 transition-colors"
                      style={{ height: `${Math.max(4, (m.revenueCents / max) * 100)}%` }}
                      title={`${m.month}: ${formatCurrency(m.revenueCents, currency)} (${m.orderCount} orders)`}
                    />
                    <span className="text-[9px] text-slate-600 rotate-45 origin-left">{m.month}</span>
                  </div>
                ));
              })()}
            </div>
            {analytics.avgOrderValueCents > 0 && (
              <p className="text-xs text-slate-500">
                Avg order value: <span className="text-slate-300">{formatCurrency(analytics.avgOrderValueCents, currency)}</span>
              </p>
            )}
          </section>
        )}

        {/* Top listings by revenue */}
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
          <h3 className="font-semibold">Top listings by revenue</h3>
          {topListings.length === 0 ? (
            <p className="text-sm text-slate-500">No completed sales yet.</p>
          ) : (
            <ul className="space-y-2">
              {topListings.map(([id, data]) => (
                <li key={id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 truncate max-w-[60%]">{data.title}</span>
                  <span className="text-emerald-400 font-medium">
                    {formatCurrency(data.revenue, currency)} <span className="text-slate-500 text-xs">({data.count} sold)</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Active listings summary */}
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">My listings</h3>
            <Link href={"/listings" as any} className="text-xs text-amber-400 hover:underline">
              Manage →
            </Link>
          </div>
          {!listings || listings.data.length === 0 ? (
            <p className="text-sm text-slate-500">No listings yet.</p>
          ) : (
            <ul className="space-y-2">
              {listings.data.slice(0, 6).map((listing) => (
                <li key={listing.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-slate-300 truncate max-w-[60%]">{listing.title}</p>
                    <p className="text-xs text-slate-500">{listing.status}</p>
                  </div>
                  <span className="text-slate-400">
                    {formatCurrency(listing.priceCents, listing.currency ?? 'USD')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = 'text-white',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-1">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
