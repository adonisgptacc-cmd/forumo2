'use client';

import Link from 'next/link';
import { use } from 'react';
import { useAdminOrder, useUpdateOrderStatus } from '../../../../../lib/react-query/hooks';

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'border-yellow-700 text-yellow-400',
  CONFIRMED: 'border-blue-700   text-blue-400',
  PAID:      'border-cyan-700   text-cyan-400',
  FULFILLED: 'border-indigo-700 text-indigo-400',
  DELIVERED: 'border-teal-700   text-teal-400',
  COMPLETED: 'border-emerald-700 text-emerald-400',
  CANCELLED: 'border-red-700    text-red-400',
  REFUNDED:  'border-slate-700  text-slate-400',
  DISPUTED:  'border-orange-700 text-orange-400',
};

const ESCROW_COLORS: Record<string, string> = {
  HOLDING:  'border-amber-700  text-amber-400',
  RELEASED: 'border-emerald-700 text-emerald-400',
  REFUNDED: 'border-slate-700  text-slate-400',
  DISPUTED: 'border-orange-700 text-orange-400',
};

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100);
}

function Badge({ label, colorMap }: { label: string; colorMap: Record<string, string> }) {
  const cls = colorMap[label] ?? 'border-slate-700 text-slate-400';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: order, isLoading, isError } = useAdminOrder(id);
  const updateStatus = useUpdateOrderStatus();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse p-6">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-xl bg-slate-800" />)}
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="p-6 rounded-xl border border-red-800 bg-red-900/20 text-center">
        <p className="text-red-400 mb-2">Order not found.</p>
        <Link href="/admin" className="text-sm text-amber-400 hover:underline">← Back to Admin</Link>
      </div>
    );
  }

  const totalCents = order.totalItemCents + order.shippingCents + order.feeCents;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="text-xs text-slate-500 hover:text-slate-300">← Admin dashboard</Link>
          <h1 className="mt-1 text-2xl font-bold">Order {order.orderNumber}</h1>
          <p className="text-sm text-slate-400">
            Placed {order.placedAt ? new Date(order.placedAt).toLocaleString() : '—'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge label={order.status} colorMap={STATUS_COLORS} />
          <Badge label={order.paymentStatus} colorMap={{
            PENDING: 'border-yellow-700 text-yellow-400',
            CAPTURED: 'border-emerald-700 text-emerald-400',
            SETTLED: 'border-emerald-700 text-emerald-400',
            FAILED: 'border-red-700 text-red-400',
            REFUNDED: 'border-slate-700 text-slate-400',
          }} />
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Buyer</h3>
          <p className="text-sm font-medium">{(order as any).buyer?.name ?? order.buyerId}</p>
          <p className="text-xs text-slate-400">{(order as any).buyer?.email ?? '—'}</p>
          <p className="text-xs text-slate-500">ID: {order.buyerId}</p>
        </section>
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Seller</h3>
          <p className="text-sm font-medium">{(order as any).seller?.name ?? order.sellerId}</p>
          <p className="text-xs text-slate-400">{(order as any).seller?.email ?? '—'}</p>
          <p className="text-xs text-slate-500">ID: {order.sellerId}</p>
        </section>
      </div>

      {/* Items */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Line items</h3>
        <ul className="divide-y divide-slate-800">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">{item.listingTitle}</p>
                {item.variantLabel && <p className="text-xs text-slate-500">{item.variantLabel}</p>}
                <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
              </div>
              <p className="text-slate-300">{fmt(item.unitPriceCents * item.quantity, item.currency)}</p>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-800 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Items subtotal</span><span>{fmt(order.totalItemCents, order.currency)}</span>
          </div>
          {order.shippingCents > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Shipping</span><span>{fmt(order.shippingCents, order.currency)}</span>
            </div>
          )}
          {order.feeCents > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Platform fee</span><span>{fmt(order.feeCents, order.currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-white pt-1">
            <span>Total</span><span>{fmt(totalCents, order.currency)}</span>
          </div>
        </div>
      </section>

      {/* Escrow */}
      {order.escrow && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Escrow</h3>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">{fmt(order.escrow.amountCents, order.escrow.currency)}</span>
            <Badge label={order.escrow.status} colorMap={ESCROW_COLORS} />
          </div>
          {order.escrow.releaseDate && (
            <p className="text-xs text-slate-500">Release date: {new Date(order.escrow.releaseDate).toLocaleString()}</p>
          )}
          {(order.escrow as any).disputes && (order.escrow as any).disputes.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-semibold text-orange-400">Disputes</p>
              {((order.escrow as any).disputes as any[]).map((d: any) => (
                <div key={d.id} className="rounded-lg border border-orange-800 bg-orange-950/20 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-orange-300 font-medium">{d.status}</span>
                    <span className="text-slate-400">{new Date(d.createdAt ?? d.openedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-300">{d.reason}</p>
                  {d.resolution && <p className="text-emerald-400">Resolution: {d.resolution}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Shipments */}
      {order.shipments && order.shipments.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Shipment</h3>
          {order.shipments.map((s: any) => (
            <div key={s.id} className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <Badge label={s.status} colorMap={{
                  IN_TRANSIT: 'border-blue-700 text-blue-400',
                  DELIVERED: 'border-emerald-700 text-emerald-400',
                  PENDING: 'border-slate-700 text-slate-400',
                }} />
              </div>
              {s.carrier && <p className="text-slate-400">Carrier: <span className="text-white">{s.carrier}</span></p>}
              {s.trackingNumber && <p className="text-slate-400">Tracking: <span className="font-mono text-white">{s.trackingNumber}</span></p>}
              {s.estimatedDelivery && <p className="text-xs text-slate-500">ETA: {new Date(s.estimatedDelivery).toLocaleDateString()}</p>}
            </div>
          ))}
        </section>
      )}

      {/* Timeline */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Timeline</h3>
        <ol className="relative border-l border-slate-700 pl-5 space-y-4">
          {order.timeline.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[1.45rem] top-0.5 h-3 w-3 rounded-full border-2 border-slate-700 bg-amber-500" />
              <p className="text-sm font-medium">{event.status}</p>
              {event.note && <p className="text-xs text-slate-500">{event.note}</p>}
              <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
              {(event as any).actor && (
                <p className="text-xs text-slate-600">by {(event as any).actor.name ?? (event as any).actor.email}</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Admin actions */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Admin actions</h3>
        <p className="text-xs text-slate-500">Force-update order status (use with caution).</p>
        <div className="flex flex-wrap gap-2">
          {(['CONFIRMED','PAID','FULFILLED','DELIVERED','COMPLETED','CANCELLED','REFUNDED'] as const).map((s) => (
            <button
              key={s}
              disabled={order.status === s || updateStatus.isPending}
              onClick={() => updateStatus.mutate({ id: order.id, status: s, note: 'Admin override' })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-30 ${
                order.status === s
                  ? 'border-amber-600 bg-amber-600/20 text-amber-300'
                  : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {updateStatus.isError && (
          <p className="text-xs text-red-400">{(updateStatus.error as Error)?.message}</p>
        )}
        {updateStatus.isSuccess && (
          <p className="text-xs text-emerald-400">Status updated.</p>
        )}
      </section>
    </div>
  );
}
