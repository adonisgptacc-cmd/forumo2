"use client";

import Link from "next/link";
import { use } from "react";
import {
  useAdminOrder,
  useUpdateOrderStatus,
} from "../../../../../lib/react-query/hooks";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "border-yellow-200 bg-yellow-50 text-yellow-700",
  CONFIRMED: "border-blue-200   bg-blue-50   text-blue-700",
  PAID: "border-cyan-200   bg-cyan-50   text-cyan-700",
  FULFILLED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  DELIVERED: "border-teal-200   bg-teal-50   text-teal-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-red-200    bg-red-50    text-red-700",
  REFUNDED:
    "border-[color:var(--line)] bg-[color:var(--surface-2)] text-[color:var(--ink-3)]",
  DISPUTED: "border-orange-200 bg-orange-50 text-orange-700",
};

const ESCROW_COLORS: Record<string, string> = {
  HOLDING: "border-amber-200  bg-amber-50  text-amber-700",
  RELEASED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REFUNDED:
    "border-[color:var(--line)] bg-[color:var(--surface-2)] text-[color:var(--ink-3)]",
  DISPUTED: "border-orange-200 bg-orange-50 text-orange-700",
};

const PAYMENT_COLORS: Record<string, string> = {
  PENDING: "border-yellow-200 bg-yellow-50 text-yellow-700",
  AUTHORIZED: "border-blue-200   bg-blue-50   text-blue-700",
  CAPTURED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SETTLED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FAILED: "border-red-200    bg-red-50    text-red-700",
  REFUNDED:
    "border-[color:var(--line)] bg-[color:var(--surface-2)] text-[color:var(--ink-3)]",
};

const SHIPMENT_COLORS: Record<string, string> = {
  IN_TRANSIT: "border-blue-200   bg-blue-50   text-blue-700",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PENDING:
    "border-[color:var(--line)] bg-[color:var(--surface-2)] text-[color:var(--ink-3)]",
};

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    cents / 100,
  );
}

function Badge({
  label,
  colorMap,
}: {
  label: string;
  colorMap: Record<string, string>;
}) {
  const cls =
    colorMap[label] ??
    "border-[color:var(--line)] bg-[color:var(--surface-2)] text-[color:var(--ink-3)]";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
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
      <div className="space-y-4 p-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="p-6 alert alert-error text-center rounded-xl">
        <p className="mb-2">Order not found.</p>
        <Link
          href="/admin"
          className="text-sm text-[color:var(--accent)] hover:underline"
        >
          ← Back to Admin
        </Link>
      </div>
    );
  }

  const totalCents =
    order.totalItemCents + order.shippingCents + order.feeCents;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-xs text-[color:var(--ink-3)] hover:text-[color:var(--ink)]"
          >
            ← Admin dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">
            Order {order.orderNumber}
          </h1>
          <p className="text-sm text-[color:var(--ink-3)]">
            Placed{" "}
            {order.placedAt ? new Date(order.placedAt).toLocaleString() : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge label={order.status} colorMap={STATUS_COLORS} />
          <Badge label={order.paymentStatus} colorMap={PAYMENT_COLORS} />
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="card p-5 space-y-1">
          <h3 className="eyebrow">Buyer</h3>
          <p className="text-sm font-medium text-[color:var(--ink)]">
            {(order as any).buyer?.name ?? order.buyerId}
          </p>
          <p className="text-xs text-[color:var(--ink-2)]">
            {(order as any).buyer?.email ?? "—"}
          </p>
          <p className="text-xs text-[color:var(--ink-3)]">
            ID: {order.buyerId}
          </p>
        </section>
        <section className="card p-5 space-y-1">
          <h3 className="eyebrow">Seller</h3>
          <p className="text-sm font-medium text-[color:var(--ink)]">
            {(order as any).seller?.name ?? order.sellerId}
          </p>
          <p className="text-xs text-[color:var(--ink-2)]">
            {(order as any).seller?.email ?? "—"}
          </p>
          <p className="text-xs text-[color:var(--ink-3)]">
            ID: {order.sellerId}
          </p>
        </section>
      </div>

      {/* Items */}
      <section className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[color:var(--ink)]">
          Line items
        </h3>
        <ul className="divide-y divide-[color:var(--line)]">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between py-3 text-sm"
            >
              <div>
                <p className="font-medium text-[color:var(--ink)]">
                  {item.listingTitle}
                </p>
                {item.variantLabel && (
                  <p className="text-xs text-[color:var(--ink-3)]">
                    {item.variantLabel}
                  </p>
                )}
                <p className="text-xs text-[color:var(--ink-3)]">
                  Qty: {item.quantity}
                </p>
              </div>
              <p className="text-[color:var(--ink-2)]">
                {fmt(item.unitPriceCents * item.quantity, item.currency)}
              </p>
            </li>
          ))}
        </ul>
        <div className="border-t border-[color:var(--line)] pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-[color:var(--ink-3)]">
            <span>Items subtotal</span>
            <span>{fmt(order.totalItemCents, order.currency)}</span>
          </div>
          {order.shippingCents > 0 && (
            <div className="flex justify-between text-[color:var(--ink-3)]">
              <span>Shipping</span>
              <span>{fmt(order.shippingCents, order.currency)}</span>
            </div>
          )}
          {order.feeCents > 0 && (
            <div className="flex justify-between text-[color:var(--ink-3)]">
              <span>Platform fee</span>
              <span>{fmt(order.feeCents, order.currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-[color:var(--ink)] pt-1">
            <span>Total</span>
            <span>{fmt(totalCents, order.currency)}</span>
          </div>
        </div>
      </section>

      {/* Escrow */}
      {order.escrow && (
        <section className="card p-5 space-y-2">
          <h3 className="text-sm font-semibold text-[color:var(--ink)]">
            Escrow
          </h3>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[color:var(--ink-2)]">
              {fmt(order.escrow.amountCents, order.escrow.currency)}
            </span>
            <Badge label={order.escrow.status} colorMap={ESCROW_COLORS} />
          </div>
          {order.escrow.releaseDate && (
            <p className="text-xs text-[color:var(--ink-3)]">
              Release date:{" "}
              {new Date(order.escrow.releaseDate).toLocaleString()}
            </p>
          )}
          {(order.escrow as any).disputes &&
            (order.escrow as any).disputes.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-semibold text-orange-700">
                  Disputes
                </p>
                {((order.escrow as any).disputes as any[]).map((d: any) => (
                  <div
                    key={d.id}
                    className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-orange-700 font-medium">
                        {d.status}
                      </span>
                      <span className="text-[color:var(--ink-3)]">
                        {new Date(
                          d.createdAt ?? d.openedAt,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[color:var(--ink-2)]">{d.reason}</p>
                    {d.resolution && (
                      <p className="text-emerald-700">
                        Resolution: {d.resolution}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
        </section>
      )}

      {/* Shipments */}
      {order.shipments && order.shipments.length > 0 && (
        <section className="card p-5 space-y-2">
          <h3 className="text-sm font-semibold text-[color:var(--ink)]">
            Shipment
          </h3>
          {order.shipments.map((s: any) => (
            <div key={s.id} className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <Badge label={s.status} colorMap={SHIPMENT_COLORS} />
              </div>
              {s.carrier && (
                <p className="text-[color:var(--ink-3)]">
                  Carrier:{" "}
                  <span className="text-[color:var(--ink)]">{s.carrier}</span>
                </p>
              )}
              {s.trackingNumber && (
                <p className="text-[color:var(--ink-3)]">
                  Tracking:{" "}
                  <span className="font-mono text-[color:var(--ink)]">
                    {s.trackingNumber}
                  </span>
                </p>
              )}
              {s.estimatedDelivery && (
                <p className="text-xs text-[color:var(--ink-3)]">
                  ETA: {new Date(s.estimatedDelivery).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Timeline */}
      <section className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[color:var(--ink)]">
          Timeline
        </h3>
        <ol className="relative border-l border-[color:var(--line)] pl-5 space-y-4">
          {order.timeline.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[1.45rem] top-0.5 h-3 w-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--accent)]" />
              <p className="text-sm font-medium text-[color:var(--ink)]">
                {event.status}
              </p>
              {event.note && (
                <p className="text-xs text-[color:var(--ink-3)]">
                  {event.note}
                </p>
              )}
              <p className="text-xs text-[color:var(--ink-3)]">
                {new Date(event.createdAt).toLocaleString()}
              </p>
              {(event as any).actor && (
                <p className="text-xs text-[color:var(--ink-3)]">
                  by {(event as any).actor.name ?? (event as any).actor.email}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Admin actions */}
      <section className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[color:var(--ink)]">
          Admin actions
        </h3>
        <p className="text-xs text-[color:var(--ink-3)]">
          Force-update order status (use with caution).
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              "CONFIRMED",
              "PAID",
              "FULFILLED",
              "DELIVERED",
              "COMPLETED",
              "CANCELLED",
              "REFUNDED",
            ] as const
          ).map((s) => (
            <button
              key={s}
              disabled={order.status === s || updateStatus.isPending}
              onClick={() =>
                updateStatus.mutate({
                  id: order.id,
                  status: s,
                  note: "Admin override",
                })
              }
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                order.status === s
                  ? "border-[color:var(--accent)] bg-amber-50 text-amber-700"
                  : "border-[color:var(--line-2)] text-[color:var(--ink-2)] hover:border-[color:var(--accent)] hover:text-[color:var(--ink)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {updateStatus.isError && (
          <p className="text-xs text-red-600">
            {(updateStatus.error as Error)?.message}
          </p>
        )}
        {updateStatus.isSuccess && (
          <p className="text-xs text-emerald-700">Status updated.</p>
        )}
      </section>
    </div>
  );
}
