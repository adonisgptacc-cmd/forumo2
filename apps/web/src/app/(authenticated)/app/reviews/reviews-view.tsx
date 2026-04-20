'use client';

import { useCurrentUser, useSellerReviewRollup } from '../../../../lib/react-query/hooks';

export function SellerReviewsView() {
  const { user } = useCurrentUser();
  const { data: rollup, isLoading } = useSellerReviewRollup(user?.id ?? null);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-40 rounded-xl bg-slate-800" />
        <div className="h-24 rounded-xl bg-slate-800" />
      </div>
    );
  }

  if (!rollup) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-10 text-center space-y-2">
        <p className="text-3xl">★</p>
        <p className="text-slate-300 font-medium">No reviews yet</p>
        <p className="text-sm text-slate-500">
          Reviews from buyers will appear here once you complete orders.
        </p>
      </div>
    );
  }

  const stars = [5, 4, 3, 2, 1] as const;
  const starCounts: Record<number, number> = {
    5: rollup.star5,
    4: rollup.star4,
    3: rollup.star3,
    2: rollup.star2,
    1: rollup.star1,
  };
  const avg = Number(rollup.averageRating);

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="text-center sm:text-left shrink-0">
            <p className="text-6xl font-bold text-amber-400">{avg.toFixed(1)}</p>
            <div className="flex justify-center sm:justify-start gap-0.5 mt-2 text-xl">
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className={avg >= s ? 'text-amber-400' : 'text-slate-700'}>★</span>
              ))}
            </div>
            <p className="text-sm text-slate-400 mt-2">
              {rollup.publishedCount} published review{rollup.publishedCount !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex-1 space-y-2">
            {stars.map((s) => {
              const count = starCounts[s] ?? 0;
              const pct = rollup.publishedCount > 0
                ? Math.round((count / rollup.publishedCount) * 100)
                : 0;
              return (
                <div key={s} className="flex items-center gap-3 text-xs">
                  <span className="text-amber-400 w-5 text-right shrink-0">{s}★</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-slate-500 w-5 text-right shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Status breakdown */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Review Status Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Total" value={rollup.reviewCount} />
          <MiniStat label="Published" value={rollup.publishedCount} color="text-emerald-400" />
          <MiniStat label="Pending" value={rollup.pendingCount} color="text-yellow-400" />
          <MiniStat label="Flagged" value={rollup.flaggedCount} color="text-red-400" />
        </div>
      </section>

      {rollup.lastReviewAt && (
        <p className="text-xs text-slate-600 text-right">
          Last review received: {new Date(rollup.lastReviewAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 p-3 space-y-1">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
