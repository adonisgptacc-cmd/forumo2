'use client';

import Link from 'next/link';
import { useOrders, useListings, useOffers, useCurrentUser, useSellerAnalytics } from '../../../../lib/react-query/hooks';

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
      <div className="space-y-8">
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card card-pad space-y-2">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-7 w-20" />
              <div className="skeleton h-3 w-28" />
            </div>
          ))}
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-[14px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Revenue stats */}
      <section className="stagger grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatCurrency(totalRevenueCents, currency)}
          sub={`${completedOrders.length} completed orders`}
          color="var(--escrow)"
        />
        <StatCard
          label="Pending revenue"
          value={formatCurrency(pendingRevenueCents, currency)}
          sub={`${pendingOrders.length} orders in progress`}
          color="oklch(0.55 0.140 60)"
        />
        <StatCard
          label="Shipped"
          value={String(shippedOrders.length)}
          sub="fulfilled, awaiting delivery"
          color="var(--ink)"
        />
        <StatCard
          label="Pending offers"
          value={String(pendingOffers.length)}
          sub={`${receivedOffers.length} total received`}
          color="var(--accent)"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent orders */}
        <section className="card card-pad space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="h3">Recent orders</h3>
            <Link href={"/app/orders" as any} className="text-xs text-[color:var(--accent)] hover:underline">
              All orders →
            </Link>
          </div>
          {myOrders.length === 0 ? (
            <p className="text-sm muted">No orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {myOrders.slice(0, 6).map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/app/orders/${order.id}` as any}
                    className="flex items-center justify-between rounded-lg border border-[color:var(--line)] px-3 py-2 transition-colors hover:border-[color:var(--accent)]"
                  >
                    <div>
                      <p className="text-sm font-medium">{order.orderNumber}</p>
                      <p className="text-xs muted">
                        {order.status} · {order.placedAt ? timeAgo(order.placedAt) : ''}
                      </p>
                    </div>
                    <span className="text-sm subtle">
                      {formatCurrency(order.totalItemCents, order.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Returns needing response */}
        <section className="card card-pad space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="h3">Return requests</h3>
            <Link href={"/app/dashboard/returns" as any} className="text-xs text-[color:var(--accent)] hover:underline">
              Manage returns →
            </Link>
          </div>
          <p className="text-sm muted">
            Review and respond to buyer return requests.
          </p>
        </section>

        {/* Pending offers */}
        <section className="card card-pad space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="h3">Offers to review</h3>
            <Link href={"/app/offers" as any} className="text-xs text-[color:var(--accent)] hover:underline">
              All offers →
            </Link>
          </div>
          {pendingOffers.length === 0 ? (
            <p className="text-sm muted">No pending offers.</p>
          ) : (
            <ul className="space-y-2">
              {pendingOffers.slice(0, 5).map((offer) => (
                <li
                  key={offer.id}
                  className="rounded-lg px-3 py-2"
                  style={{ background: 'var(--accent-bg)', border: '1px solid transparent' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{offer.listing?.title ?? 'Listing'}</p>
                      <p className="text-xs muted">
                        From {offer.buyer?.name ?? 'Buyer'} · {timeAgo(offer.createdAt)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[color:var(--accent-2)]">
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
          <section className="card card-pad space-y-3 lg:col-span-2">
            <h3 className="h3">Revenue — last 12 months</h3>
            <div className="flex items-end gap-1 h-24">
              {(() => {
                const max = Math.max(...analytics.revenueByMonth.map((m) => m.revenueCents), 1);
                return analytics.revenueByMonth.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm transition-[height,opacity] hover:opacity-100"
                      style={{
                        height: `${Math.max(4, (m.revenueCents / max) * 100)}%`,
                        background: 'var(--accent)',
                        opacity: 0.8,
                      }}
                      title={`${m.month}: ${formatCurrency(m.revenueCents, currency)} (${m.orderCount} orders)`}
                    />
                    <span className="text-[9px] muted rotate-45 origin-left">{m.month}</span>
                  </div>
                ));
              })()}
            </div>
            {analytics.avgOrderValueCents > 0 && (
              <p className="text-xs muted">
                Avg order value: <span className="subtle font-medium">{formatCurrency(analytics.avgOrderValueCents, currency)}</span>
              </p>
            )}
          </section>
        )}

        {/* Top listings by revenue */}
        <section className="card card-pad space-y-3">
          <h3 className="h3">Top listings by revenue</h3>
          {topListings.length === 0 ? (
            <p className="text-sm muted">No completed sales yet.</p>
          ) : (
            <ul className="space-y-2">
              {topListings.map(([id, data]) => (
                <li key={id} className="flex items-center justify-between text-sm">
                  <span className="subtle truncate max-w-[60%]">{data.title}</span>
                  <span className="text-[color:var(--escrow)] font-medium">
                    {formatCurrency(data.revenue, currency)} <span className="muted text-xs">({data.count} sold)</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Active listings summary */}
        <section className="card card-pad space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="h3">My listings</h3>
            <Link href={"/listings" as any} className="text-xs text-[color:var(--accent)] hover:underline">
              Manage →
            </Link>
          </div>
          {!listings || listings.data.length === 0 ? (
            <p className="text-sm muted">No listings yet.</p>
          ) : (
            <ul className="space-y-2">
              {listings.data.slice(0, 6).map((listing) => (
                <li key={listing.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="subtle truncate max-w-[60%]">{listing.title}</p>
                    <p className="text-xs muted">{listing.status}</p>
                  </div>
                  <span className="subtle">
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
  color = 'var(--ink)',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="card card-pad space-y-1">
      <p className="eyebrow">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs muted">{sub}</p>}
    </div>
  );
}
