'use client';

import Link from 'next/link';

import { useOrders } from '../../../../lib/react-query/hooks';
import { ErrorBoundary } from '../../../../components/ErrorBoundary';

export function OrdersBoard() {
  const { data, isLoading } = useOrders();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card card-pad space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton h-5 w-32" />
              </div>
              <div className="skeleton h-6 w-20 rounded-full" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="skeleton h-3 w-10" />
                <div className="skeleton h-3 w-48" />
              </div>
              <div className="space-y-2">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton h-3 w-40" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card card-pad space-y-2">
        <p className="subtle">No orders yet.</p>
        <p className="text-sm muted">Use the checkout simulator to create your first escrow order.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((order) => (
        <ErrorBoundary
          key={order.id}
          fallback={
            <div className="card card-pad py-4 text-center text-sm muted">
              Could not load this order
            </div>
          }
        >
        <article className="card card-pad space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-3)]">{order.status}</p>
              <h2 className="text-xl font-semibold">Order {order.orderNumber}</h2>
            </div>
            {order.escrow ? <EscrowStatus status={order.escrow.status} /> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-sm muted">Items</p>
              <ul className="text-sm subtle">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity} × {item.listingTitle}{' '}
                    <span className="muted">{item.variantLabel ? `(${item.variantLabel})` : null}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm muted">Timeline</p>
              <ol className="space-y-1 text-xs muted">
                {order.timeline.map((event) => (
                  <li key={event.id}>{event.status} · {new Date(event.createdAt).toLocaleString()}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm muted">
            <p>
              Total {(order.totalItemCents + order.shippingCents + order.feeCents) / 100} {order.currency}
            </p>
            <div className="flex gap-3">
              <Link className="text-[color:var(--accent)] hover:underline" href={`/app/orders/${order.id}` as any}>
                View details →
              </Link>
            </div>
          </div>
        </article>
        </ErrorBoundary>
      ))}
    </div>
  );
}

function EscrowStatus({ status }: { status: string }) {
  const label =
    status === 'HOLDING'
      ? 'Funds held'
      : status === 'RELEASED'
        ? 'Released'
        : status === 'REFUNDED'
          ? 'Refunded'
          : 'Disputed';
  return <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">{label}</span>;
}
