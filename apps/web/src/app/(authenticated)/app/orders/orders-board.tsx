'use client';

import Link from 'next/link';

import { useOrders } from '../../../../lib/react-query/hooks';

export function OrdersBoard() {
  const { data, isLoading } = useOrders();

  if (isLoading) {
    return <p className="text-slate-400">Loading orders…</p>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="grid-card space-y-2">
        <p className="text-slate-300">No orders yet.</p>
        <p className="text-sm text-slate-500">Use the checkout simulator to create your first escrow order.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((order) => (
        <article key={order.id} className="grid-card space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{order.status}</p>
              <h2 className="text-xl font-semibold">Order {order.orderNumber}</h2>
            </div>
            {order.escrow ? <EscrowStatus status={order.escrow.status} /> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Items</p>
              <ul className="text-sm text-slate-300">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity} × {item.listingTitle}{' '}
                    <span className="text-slate-500">{item.variantLabel ? `(${item.variantLabel})` : null}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm text-slate-500">Timeline</p>
              <ol className="space-y-1 text-xs text-slate-400">
                {order.timeline.map((event) => (
                  <li key={event.id}>{event.status} · {new Date(event.createdAt).toLocaleString()}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
            <p>
              Total {(order.totalItemCents + order.shippingCents + order.feeCents) / 100} {order.currency}
            </p>
            <Link className="text-amber-300" href={`/app/messages?orderId=${order.id}`}>
              Contact buyer →
            </Link>
          </div>
        </article>
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
  return <span className="rounded-full border border-amber-300 px-3 py-1 text-xs text-amber-200">{label}</span>;
}
