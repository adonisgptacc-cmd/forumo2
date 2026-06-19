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
  requested: 'bg-amber-50 text-amber-700 border-amber-200',
  awaiting_seller: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  shipped: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  received: 'bg-purple-50 text-purple-700 border-purple-200',
  refunded: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function ReturnsBoard() {
  const { data: returns, isLoading, error } = useReturns();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">Failed to load returns.</p>;
  }

  if (!returns?.length) {
    return (
      <div className="card py-16 text-center">
        <p className="muted">No return requests yet.</p>
        <p className="mt-1 text-sm muted">
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
      <div className="flex items-center gap-4 card px-5 py-4 transition hover:bg-[color:var(--surface-2)]">
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-[color:var(--ink)]">
            Order #{ret.order?.orderNumber ?? ret.orderId.slice(0, 8)}
          </p>
          <p className="mt-0.5 text-xs muted">
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
          <p className="mt-1 text-xs muted">
            {ret.order?.currency?.toUpperCase()}{' '}
            {(ret.refundAmount / 100).toFixed(2)}
          </p>
        </div>
      </div>
    </Link>
  );
}
