'use client';

import { useSellerAnalytics } from '../../../../lib/react-query/hooks';

function fmtMoney(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500',
  CONFIRMED: 'bg-blue-500',
  PAID: 'bg-indigo-500',
  FULFILLED: 'bg-violet-500',
  DELIVERED: 'bg-emerald-400',
  COMPLETED: 'bg-emerald-600',
  CANCELLED: 'bg-red-500',
  REFUNDED: 'bg-slate-500',
  DISPUTED: 'bg-orange-500',
};

export function AnalyticsView() {
  const { data, isLoading, isError } = useSellerAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-800" />)}
        </div>
        <div className="h-52 rounded-xl bg-slate-800" />
        <div className="h-40 rounded-xl bg-slate-800" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-900/20 p-6 text-center">
        <p className="text-red-400">Failed to load analytics. Make sure you have seller access.</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.revenueByMonth.map((m) => m.revenueCents), 1);
  const totalOrders = Object.values(data.ordersByStatus).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Orders" value={data.totalOrders.toLocaleString()} />
        <StatCard label="Completed" value={data.completedOrders.toLocaleString()} />
        <StatCard label="Total Revenue" value={fmtMoney(data.totalRevenueCents)} accent />
        <StatCard label="Avg Order Value" value={fmtMoney(data.avgOrderValueCents)} />
      </div>

      {/* Revenue bar chart */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Revenue — Last 12 Months</h3>
        <div className="flex items-end gap-1 h-44 pt-2">
          {data.revenueByMonth.map((m) => {
            const heightPct = (m.revenueCents / maxRevenue) * 100;
            return (
              <div key={m.month} className="group flex flex-col items-center flex-1 h-full justify-end gap-0.5">
                <span className="hidden group-hover:block text-[10px] text-amber-300 whitespace-nowrap">
                  {fmtMoney(m.revenueCents)}
                </span>
                <div
                  title={`${m.month}: ${fmtMoney(m.revenueCents)} · ${m.orderCount} order${m.orderCount !== 1 ? 's' : ''}`}
                  className="w-full rounded-t bg-amber-500/60 group-hover:bg-amber-400 transition-colors"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
                <span className="text-[10px] text-slate-600 mt-1 truncate w-full text-center">{m.month}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Orders by status */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Orders by Status</h3>
        <div className="space-y-2.5">
          {Object.entries(data.ordersByStatus)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => {
              const pct = Math.round((count / totalOrders) * 100);
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">{status}</span>
                    <span className="text-slate-300">
                      {count}{' '}
                      <span className="text-slate-600">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${STATUS_COLORS[status] ?? 'bg-slate-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-1">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold ${accent ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}
