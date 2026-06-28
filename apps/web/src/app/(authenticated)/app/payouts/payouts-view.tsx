'use client';

import { useState } from 'react';
import { usePayoutBalance, usePayouts } from '../../../../lib/react-query/hooks';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  paid: 'Paid',
  failed: 'Failed',
};

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PayoutsView() {
  const [page, setPage] = useState(1);
  const { data: balance, isLoading: balanceLoading } = usePayoutBalance();
  const { data: payouts, isLoading: payoutsLoading } = usePayouts(page);

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Payouts</h1>

      {/* Balance card */}
      <div className="card-forumo grid grid-cols-2 sm:grid-cols-3 gap-4">
        {balanceLoading ? (
          <div className="col-span-3 h-16 animate-pulse rounded bg-slate-100" />
        ) : balance ? (
          <>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Available</p>
              <p className="text-2xl font-bold mt-1">
                {formatMoney(balance.availableCents, balance.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total paid out</p>
              <p className="text-xl font-semibold mt-1">
                {formatMoney(balance.totalPaidCents, balance.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Next payout</p>
              <p className="text-sm mt-1 text-slate-700">
                {balance.nextPayoutDate
                  ? formatDate(balance.nextPayoutDate)
                  : 'Not scheduled'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Min. {formatMoney(balance.minimumPayoutCents, balance.currency)}
              </p>
            </div>
          </>
        ) : (
          <p className="text-slate-500 text-sm col-span-3">Balance unavailable.</p>
        )}
      </div>

      {/* Payout history */}
      <div className="card-forumo space-y-3">
        <h2 className="text-base font-semibold">Payout history</h2>

        {payoutsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : !payouts?.data?.length ? (
          <p className="text-sm text-slate-500 py-4 text-center">No payouts yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {payouts.data.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{formatMoney(p.amountCents, p.currency)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(p.createdAt)}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLASS[p.status] ?? 'bg-slate-100 text-slate-600'}`}
                >
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {payouts && (
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded px-3 py-1.5 text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(payouts.data?.length ?? 0) < 20}
              className="rounded px-3 py-1.5 text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
