'use client';

import Link from 'next/link';
import type { ReturnStatus, SafeReturn } from '@forumo/shared';
import { useReturns } from '../../../../lib/react-query/hooks';

const STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: 'Requested',
  awaiting_seller: 'Awaiting seller',
  approved: 'Approved',
  rejected: 'Rejected',
  shipped: 'Shipped back',
  received: 'Received',
  refunded: 'Refunded',
};

const STATUS_COLORS: Record<ReturnStatus, string> = {
  requested: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  awaiting_seller: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  approved: 'bg-green-500/10 text-green-300 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-300 border-red-500/20',
  shipped: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  received: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  refunded: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
};

export function ReturnsBoard() {
  const { data: returns, isLoading, error } = useReturns();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-400">Failed to load returns.</p>;
  }

  if (!returns?.length) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 py-16 text-center">
        <p className="text-slate-400">No return requests yet.</p>
        <p className="mt-1 text-sm text-slate-500">
          Returns you request or receive will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {returns.map((ret) => (
        <ReturnRow key={ret.id} ret={ret} />
      ))}
    </div>
  );
}

function ReturnRow({ ret }: { ret: SafeReturn }) {
  const status = ret.status as ReturnStatus;
  return (
    <Link href={`/app/returns/${ret.id}` as any} className="block">
      <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 px-5 py-4 transition hover:bg-white/10">
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-slate-100">
            Order #{ret.order?.orderNumber ?? ret.orderId.slice(0, 8)}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {ret.reason.replace(/_/g, ' ')} ·{' '}
            {new Date(ret.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
          >
            {STATUS_LABELS[status]}
          </span>
          <p className="mt-1 text-xs text-slate-400">
            {ret.order?.currency?.toUpperCase()}{' '}
            {(ret.refundAmount / 100).toFixed(2)}
          </p>
        </div>
      </div>
    </Link>
  );
}
