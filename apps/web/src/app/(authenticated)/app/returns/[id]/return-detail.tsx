'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ReturnStatus } from '@forumo/shared';
import { useReturn, useCurrentUser } from '../../../../../lib/react-query/hooks';

type TimelineStep = {
  key: ReturnStatus | 'initiated';
  label: string;
  description: string;
};

const TIMELINE_STEPS: TimelineStep[] = [
  { key: 'initiated', label: 'Requested', description: 'Return request submitted' },
  { key: 'awaiting_seller', label: 'Awaiting seller', description: 'Seller reviewing request' },
  { key: 'approved', label: 'Approved', description: 'Return approved by seller' },
  { key: 'shipped', label: 'Shipped back', description: 'Item shipped back to seller' },
  { key: 'received', label: 'Received', description: 'Seller confirmed receipt' },
  { key: 'refunded', label: 'Refunded', description: 'Refund issued to buyer' },
];

const STATUS_ORDER: Array<ReturnStatus | 'initiated'> = [
  'initiated',
  'awaiting_seller',
  'approved',
  'shipped',
  'received',
  'refunded',
];

function getStepIndex(status: ReturnStatus): number {
  const mapping: Record<ReturnStatus, number> = {
    requested: 0,
    awaiting_seller: 1,
    approved: 2,
    shipped: 3,
    received: 4,
    refunded: 5,
    rejected: 2,
  };
  return mapping[status] ?? 0;
}

export function ReturnDetail({ id }: { id: string }) {
  const { data: ret, isLoading } = useReturn(id);
  const { user } = useCurrentUser();
  const [showDisputeConfirm, setShowDisputeConfirm] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!ret) return <p className="text-slate-400">Return not found.</p>;

  const isRejected = ret.status === 'rejected';
  const isBuyer = user?.id === ret.buyerId;
  const currentStepIndex = isRejected ? 2 : getStepIndex(ret.status as ReturnStatus);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/app/returns" className="text-sm text-slate-400 hover:text-slate-200">
          ← All returns
        </Link>
        <h2 className="mt-2 text-xl font-semibold">Return request</h2>
        <p className="text-sm text-slate-400">
          Order #{ret.order?.orderNumber ?? ret.orderId.slice(0, 8)}
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400">Reason</p>
            <p className="mt-0.5 text-sm font-medium capitalize text-slate-100">
              {ret.reason.replace(/_/g, ' ')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Refund amount</p>
            <p className="mt-0.5 text-sm font-medium text-slate-100">
              {ret.order?.currency?.toUpperCase()} {(ret.refundAmount / 100).toFixed(2)}
            </p>
          </div>
        </div>
        {ret.conditionNotes && (
          <div>
            <p className="text-sm text-slate-400">Condition notes</p>
            <p className="mt-0.5 text-sm text-slate-200">{ret.conditionNotes}</p>
          </div>
        )}
        {ret.trackingNumber && (
          <div>
            <p className="text-sm text-slate-400">Return tracking #</p>
            <p className="mt-0.5 text-sm font-mono text-slate-200">{ret.trackingNumber}</p>
          </div>
        )}
      </div>

      {/* Rejection notice */}
      {isRejected && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-3">
          <p className="text-sm font-medium text-red-300">Return declined</p>
          {ret.rejectionReason && (
            <p className="text-sm text-slate-300">
              Reason: <em>{ret.rejectionReason}</em>
            </p>
          )}
          {isBuyer && (
            <div>
              {!showDisputeConfirm ? (
                <button
                  onClick={() => setShowDisputeConfirm(true)}
                  className="text-sm font-medium text-indigo-400 hover:text-indigo-300 underline"
                >
                  Escalate to dispute
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-slate-400">
                    This will open a dispute with Forumo support, who will mediate the case.
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/app/disputes/new?returnId=${ret.id}` as any}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                    >
                      Open dispute
                    </Link>
                    <button
                      onClick={() => setShowDisputeConfirm(false)}
                      className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Vertical timeline */}
      <div>
        <h3 className="mb-4 text-sm font-medium text-slate-300">Timeline</h3>
        <ol className="relative border-l border-white/10 space-y-6 pl-6">
          {TIMELINE_STEPS.map((step, i) => {
            if (isRejected && step.key === 'shipped') {
              return (
                <li key="rejected" className="relative">
                  <span className="absolute -left-[calc(1.5rem+1px)] flex h-5 w-5 items-center justify-center rounded-full border border-red-500/40 bg-red-900/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  </span>
                  <p className="text-sm font-medium text-red-300">Rejected</p>
                  <p className="text-xs text-slate-500">Seller declined the return request</p>
                </li>
              );
            }
            if (isRejected && i >= 3) return null;

            const done = i <= currentStepIndex;
            const active = i === currentStepIndex;

            return (
              <li key={step.key} className="relative">
                <span
                  className={`absolute -left-[calc(1.5rem+1px)] flex h-5 w-5 items-center justify-center rounded-full border ${
                    done
                      ? 'border-indigo-500/60 bg-indigo-900/60'
                      : 'border-white/10 bg-slate-800'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${done ? 'bg-indigo-400' : 'bg-slate-600'}`}
                  />
                </span>
                <p
                  className={`text-sm font-medium ${
                    active ? 'text-indigo-300' : done ? 'text-slate-100' : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </p>
                <p className={`text-xs ${done ? 'text-slate-400' : 'text-slate-600'}`}>
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
