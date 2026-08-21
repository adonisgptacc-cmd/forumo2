"use client";

import Link from "next/link";
import { useState } from "react";
import { useOrders, useCurrentUser } from "../../../../lib/react-query/hooks";
import type { SafeOrder } from "@forumo/shared";

const BADGE: Record<string, string> = {
  OPEN: "border-red-200 text-red-700 bg-red-50",
  UNDER_REVIEW: "border-amber-200 text-amber-700 bg-amber-50",
  RESOLVED: "border-emerald-200 text-emerald-700 bg-emerald-50",
  CLOSED:
    "border-[color:var(--line)] text-[color:var(--ink-3)] bg-[color:var(--surface-2)]",
};

function disputeStatusLabel(order: SafeOrder): string {
  if (order.status === "DISPUTED") return "OPEN";
  if (order.status === "REFUNDED" || order.status === "COMPLETED")
    return "RESOLVED";
  return "CLOSED";
}

function disputeOpenedAt(order: SafeOrder): string | null {
  return (
    order.timeline.find((e) => e.status === "DISPUTED")?.createdAt ??
    order.placedAt ??
    null
  );
}

function hasHadDispute(order: SafeOrder): boolean {
  return (
    order.status === "DISPUTED" ||
    order.timeline.some((e) => e.status === "DISPUTED")
  );
}

export function DisputesBoard() {
  const { data: orders = [], isLoading } = useOrders();
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<"all" | "open" | "resolved">("all");

  const allDisputed = orders.filter(hasHadDispute);
  const openCount = allDisputed.filter((o) => o.status === "DISPUTED").length;
  const resolvedCount = allDisputed.filter(
    (o) => o.status !== "DISPUTED",
  ).length;

  const filtered =
    tab === "open"
      ? allDisputed.filter((o) => o.status === "DISPUTED")
      : tab === "resolved"
        ? allDisputed.filter((o) => o.status !== "DISPUTED")
        : allDisputed;

  const tabs = [
    { key: "all", label: `All (${allDisputed.length})` },
    { key: "open", label: `Open (${openCount})` },
    { key: "resolved", label: `Resolved (${resolvedCount})` },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Disputes</h2>
          <p className="mt-0.5 text-sm muted">
            Orders under escrow dispute review
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-2)] p-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-4 py-1.5 text-sm transition ${
                tab === key
                  ? "bg-[color:var(--ink)] text-[color:var(--bg)]"
                  : "muted hover:text-[color:var(--ink)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--line-2)] py-20 text-center">
          <div className="mb-4 text-5xl select-none">⚖️</div>
          <p className="text-lg font-semibold text-[color:var(--ink)]">
            No disputes — great!
          </p>
          <p className="mt-1 text-sm muted">
            All your orders are running smoothly.
          </p>
          <Link
            href={"/app/orders" as any}
            className="mt-5 rounded-full border border-[color:var(--accent)] px-5 py-2 text-sm text-[color:var(--accent)] hover:bg-[color:var(--accent-bg)]"
          >
            View orders
          </Link>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="rounded-xl border border-[color:var(--line)]">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--line)] bg-[color:var(--surface-2)]">
                  {["Order", "Item", "Opened", "Your Role", "Status", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {filtered.map((order) => {
                  const status = disputeStatusLabel(order);
                  const role =
                    user?.id === order.buyerId
                      ? "Buyer"
                      : user?.id === order.sellerId
                        ? "Seller"
                        : user?.role === "ADMIN" || user?.role === "MODERATOR"
                          ? "Admin"
                          : "—";
                  const opened = disputeOpenedAt(order);
                  const firstItem = order.items[0];
                  const badgeCls = BADGE[status] ?? BADGE.CLOSED;

                  return (
                    <tr
                      key={order.id}
                      className="bg-[color:var(--surface)] transition-colors hover:bg-[color:var(--surface-2)]"
                    >
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-[color:var(--ink-2)]">
                          {order.orderNumber}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate px-5 py-4 text-[color:var(--ink)]">
                        {firstItem?.listingTitle ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-[color:var(--ink-3)]">
                        {opened ? new Date(opened).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full border border-[color:var(--line)] px-3 py-0.5 text-xs text-[color:var(--ink-2)]">
                          {role}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-3 py-0.5 text-xs font-medium ${badgeCls}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/app/disputes/${order.id}` as any}
                          className="rounded-lg border border-[color:var(--accent)]/60 px-3 py-1.5 text-xs text-[color:var(--accent)] hover:border-[color:var(--accent-2)]"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-[color:var(--line)]">
            {filtered.map((order) => {
              const status = disputeStatusLabel(order);
              const role =
                user?.id === order.buyerId
                  ? "Buyer"
                  : user?.id === order.sellerId
                    ? "Seller"
                    : user?.role === "ADMIN" || user?.role === "MODERATOR"
                      ? "Admin"
                      : "—";
              const opened = disputeOpenedAt(order);
              const firstItem = order.items[0];
              const badgeCls = BADGE[status] ?? BADGE.CLOSED;

              return (
                <div
                  key={order.id}
                  className="px-4 py-4 space-y-2 bg-[color:var(--surface)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-[color:var(--ink-2)]">
                      {order.orderNumber}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeCls}`}
                    >
                      {status}
                    </span>
                  </div>
                  {firstItem && (
                    <p className="text-sm text-[color:var(--ink)] truncate">
                      {firstItem.listingTitle}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 text-xs text-[color:var(--ink-3)]">
                    <span>
                      {opened ? new Date(opened).toLocaleDateString() : "—"}
                    </span>
                    <span className="rounded-full border border-[color:var(--line)] px-2.5 py-0.5 text-[color:var(--ink-2)]">
                      {role}
                    </span>
                  </div>
                  <Link
                    href={`/app/disputes/${order.id}` as any}
                    className="inline-flex items-center rounded-lg border border-[color:var(--accent)]/60 px-3 min-h-[44px] text-xs text-[color:var(--accent)] hover:border-[color:var(--accent-2)]"
                  >
                    View dispute →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
