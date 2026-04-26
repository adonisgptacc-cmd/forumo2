'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useOrders, useCurrentUser } from '../../../../lib/react-query/hooks';
import type { SafeOrder } from '@forumo/shared';

const BADGE: Record<string, string> = {
  OPEN: 'border-red-700 text-red-400 bg-red-950/30',
  UNDER_REVIEW: 'border-amber-700 text-amber-400 bg-amber-950/30',
  RESOLVED: 'border-emerald-700 text-emerald-400 bg-emerald-950/30',
  CLOSED: 'border-slate-700 text-slate-400 bg-slate-900/30',
};

function disputeStatusLabel(order: SafeOrder): string {
  if (order.status === 'DISPUTED') return 'OPEN';
  if (order.status === 'REFUNDED' || order.status === 'COMPLETED') return 'RESOLVED';
  return 'CLOSED';
}

function disputeOpenedAt(order: SafeOrder): string | null {
  return order.timeline.find((e) => e.status === 'DISPUTED')?.createdAt ?? order.placedAt ?? null;
}

function hasHadDispute(order: SafeOrder): boolean {
  return (
    order.status === 'DISPUTED' ||
    order.timeline.some((e) => e.status === 'DISPUTED')
  );
}

export function DisputesBoard() {
  const { data: orders = [], isLoading } = useOrders();
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<'all' | 'open' | 'resolved'>('all');

  const allDisputed = orders.filter(hasHadDispute);
  const openCount = allDisputed.filter((o) => o.status === 'DISPUTED').length;
  const resolvedCount = allDisputed.filter((o) => o.status !== 'DISPUTED').length;

  const filtered =
    tab === 'open'
      ? allDisputed.filter((o) => o.status === 'DISPUTED')
      : tab === 'resolved'
        ? allDisputed.filter((o) => o.status !== 'DISPUTED')
        : allDisputed;

  const tabs = [
    { key: 'all', label: `All (${allDisputed.length})` },
    { key: 'open', label: `Open (${openCount})` },
    { key: 'resolved', label: `Resolved (${resolvedCount})` },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Disputes</h2>
          <p className="mt-0.5 text-sm text-slate-400">Orders under escrow dispute review</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-4 py-1.5 text-sm transition ${
                tab === key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-800" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 py-20 text-center">
          <div className="mb-4 text-5xl select-none">⚖️</div>
          <p className="text-lg font-semibold text-slate-200">No disputes — great!</p>
          <p className="mt-1 text-sm text-slate-500">All your orders are running smoothly.</p>
          <Link
            href={'/app/orders' as any}
            className="mt-5 rounded-full border border-amber-500 px-5 py-2 text-sm text-amber-400 hover:border-amber-400 hover:text-amber-300"
          >
            View orders
          </Link>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                {['Order', 'Item', 'Opened', 'Your Role', 'Status', ''].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((order) => {
                const status = disputeStatusLabel(order);
                const role =
                  user?.id === order.buyerId
                    ? 'Buyer'
                    : user?.id === order.sellerId
                      ? 'Seller'
                      : user?.role === 'ADMIN' || user?.role === 'MODERATOR'
                        ? 'Admin'
                        : '—';
                const opened = disputeOpenedAt(order);
                const firstItem = order.items[0];
                const badgeCls = BADGE[status] ?? BADGE.CLOSED;

                return (
                  <tr
                    key={order.id}
                    className="bg-slate-950/40 transition-colors hover:bg-slate-900/60"
                  >
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs text-slate-300">{order.orderNumber}</span>
                    </td>
                    <td className="max-w-[180px] truncate px-5 py-4 text-slate-200">
                      {firstItem?.listingTitle ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-400">
                      {opened ? new Date(opened).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full border border-slate-700 px-3 py-0.5 text-xs text-slate-300">
                        {role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full border px-3 py-0.5 text-xs font-medium ${badgeCls}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/app/disputes/${order.id}` as any}
                        className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs text-amber-400 hover:border-amber-400"
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
      )}
    </div>
  );
}
