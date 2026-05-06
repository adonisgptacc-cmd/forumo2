'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ReturnReason, ReturnStatus, SafeReturn } from '@forumo/shared';
import {
  useReturns,
  useApproveReturn,
  useRejectReturn,
  useConfirmReturnReceived,
} from '../../../../../lib/react-query/hooks';

const REASON_LABELS: Record<ReturnReason, string> = {
  not_as_described: 'Not as described',
  damaged: 'Item arrived damaged',
  not_received: 'Item not received',
  changed_mind: 'Changed my mind',
  other: 'Other',
};

const STATUS_COLORS: Record<ReturnStatus, string> = {
  requested: 'bg-yellow-500/10 text-yellow-300',
  awaiting_seller: 'bg-blue-500/10 text-blue-300',
  approved: 'bg-green-500/10 text-green-300',
  rejected: 'bg-red-500/10 text-red-300',
  shipped: 'bg-indigo-500/10 text-indigo-300',
  received: 'bg-purple-500/10 text-purple-300',
  refunded: 'bg-emerald-500/10 text-emerald-300',
};

function useCountdown(deadline: string) {
  const [remaining, setRemaining] = useState(() => {
    const ms = new Date(deadline).getTime() - Date.now();
    return Math.max(0, ms);
  });

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { remaining, hours, minutes, seconds, expired: remaining <= 0 };
}

function CountdownBadge({ deadline }: { deadline: string }) {
  const { remaining, hours, minutes, seconds, expired } = useCountdown(deadline);

  if (expired) {
    return (
      <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-300">
        Auto-approving…
      </span>
    );
  }

  const urgent = remaining < 4 * 60 * 60 * 1000; // < 4h
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
        urgent ? 'bg-red-500/10 text-red-300' : 'bg-slate-700 text-slate-300'
      }`}
    >
      {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:
      {String(seconds).padStart(2, '0')} left
    </span>
  );
}

function ReturnRow({ ret }: { ret: SafeReturn }) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const { mutateAsync: approve, isPending: approving } = useApproveReturn();
  const { mutateAsync: reject, isPending: rejecting } = useRejectReturn();
  const { mutateAsync: confirmReceived, isPending: confirming } = useConfirmReturnReceived();

  const status = ret.status as ReturnStatus;
  const needsResponse = status === 'awaiting_seller' || status === 'requested';
  const needsReceiveConfirm = status === 'shipped';

  async function handleApprove() {
    await approve(ret.id);
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    await reject({ id: ret.id, reason: rejectReason });
    setShowRejectForm(false);
  }

  async function handleReceived() {
    await confirmReceived(ret.id);
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={`/app/returns/${ret.id}` as any} className="hover:underline">
            <p className="truncate text-sm font-medium text-slate-100">
              Order #{ret.order?.orderNumber ?? ret.orderId.slice(0, 8)}
            </p>
          </Link>
          <p className="mt-0.5 text-xs text-slate-400">
            {REASON_LABELS[ret.reason as ReturnReason] ?? ret.reason} ·{' '}
            {new Date(ret.createdAt).toLocaleDateString()}
          </p>
          {ret.conditionNotes && (
            <p className="mt-2 text-sm text-slate-300 line-clamp-2">{ret.conditionNotes}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
            {status.replace(/_/g, ' ')}
          </span>
          <p className="text-xs text-slate-400">
            {ret.order?.currency?.toUpperCase()} {(ret.refundAmount / 100).toFixed(2)}
          </p>
          {needsResponse && <CountdownBadge deadline={ret.sellerResponseDeadline} />}
        </div>
      </div>

      {/* Action buttons */}
      {needsResponse && !showRejectForm && (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={approving}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
          >
            {approving ? 'Approving…' : 'Approve'}
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
          >
            Decline
          </button>
        </div>
      )}

      {showRejectForm && (
        <form onSubmit={handleReject} className="space-y-3">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why you are declining this return…"
            rows={3}
            required
            className="w-full resize-none rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!rejectReason.trim() || rejecting}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {rejecting ? 'Declining…' : 'Confirm decline'}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {needsReceiveConfirm && (
        <button
          onClick={handleReceived}
          disabled={confirming}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {confirming ? 'Processing…' : 'Confirm item received & issue refund'}
        </button>
      )}
    </div>
  );
}

export function SellerReturnsView() {
  const { data: returns, isLoading, error } = useReturns();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-400">Failed to load return requests.</p>;
  }

  if (!returns?.length) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 py-16 text-center">
        <p className="text-slate-400">No return requests.</p>
        <p className="mt-1 text-sm text-slate-500">
          Return requests from buyers will appear here.
        </p>
      </div>
    );
  }

  const pending = returns.filter((r) =>
    ['requested', 'awaiting_seller', 'shipped'].includes(r.status),
  );
  const resolved = returns.filter((r) =>
    ['approved', 'rejected', 'received', 'refunded'].includes(r.status),
  );

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-slate-300">
            Needs action{' '}
            <span className="ml-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
              {pending.length}
            </span>
          </h3>
          {pending.map((ret) => (
            <ReturnRow key={ret.id} ret={ret} />
          ))}
        </section>
      )}
      {resolved.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-slate-500">Resolved</h3>
          {resolved.map((ret) => (
            <ReturnRow key={ret.id} ret={ret} />
          ))}
        </section>
      )}
    </div>
  );
}
