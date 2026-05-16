'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  useSellerAnalyticsOverview,
  useSellerAnalyticsRevenue,
  useSellerTopListings,
  useSellerReviewsSummary,
  type AnalyticsPeriod,
  type AnalyticsGroupBy,
} from '../../../../lib/react-query/hooks';
import type { SellerTopListing, SellerRevenuePoint, SellerReviewsSummary } from '@forumo/shared';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
}

// ── Period selector ───────────────────────────────────────────────────────────

const PERIODS: { value: AnalyticsPeriod; label: string; groupBy: AnalyticsGroupBy }[] = [
  { value: '7d', label: '7 days', groupBy: 'day' },
  { value: '30d', label: '30 days', groupBy: 'day' },
  { value: '90d', label: '90 days', groupBy: 'week' },
];

function PeriodToggle({
  value,
  onChange,
}: {
  value: AnalyticsPeriod;
  onChange: (p: AnalyticsPeriod) => void;
}) {
  return (
    <div className="flex rounded-lg border border-slate-700 overflow-hidden">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            value === p.value
              ? 'bg-amber-500 text-black'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded-xl bg-slate-800 animate-pulse ${className ?? ''}`} />;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-1">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold ${accent ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

// ── Revenue section ───────────────────────────────────────────────────────────

function RevenueSection({ period, groupBy }: { period: AnalyticsPeriod; groupBy: AnalyticsGroupBy }) {
  const { data, isLoading, isError } = useSellerAnalyticsRevenue(period, groupBy);

  if (isLoading) return <Skeleton className="h-64" />;
  if (isError || !data?.length) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 h-64 flex items-center justify-center">
        <p className="text-sm text-slate-500">No revenue data for this period.</p>
      </div>
    );
  }

  const chartData = data.map((point: SellerRevenuePoint) => ({
    label: point.period,
    revenue: point.revenueCents / 100,
    orders: point.orderCount,
  }));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-slate-300">Revenue</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
          />
          <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Top listings section ──────────────────────────────────────────────────────

function TopListingsSection() {
  const { data, isLoading, isError } = useSellerTopListings(5);

  if (isLoading) return <Skeleton className="h-48" />;
  if (isError || !data?.length) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 h-32 flex items-center justify-center">
        <p className="text-sm text-slate-500">No listing data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300">Top Listings</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wide">
            <th className="px-5 py-2 text-left">Listing</th>
            <th className="px-5 py-2 text-right">Revenue</th>
            <th className="px-5 py-2 text-right">Orders</th>
            <th className="px-5 py-2 text-right">Views</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {data.map((listing: SellerTopListing) => (
            <tr key={listing.listingId} className="hover:bg-slate-800/30 transition-colors">
              <td className="px-5 py-3 text-slate-200 truncate max-w-[200px]">{listing.title}</td>
              <td className="px-5 py-3 text-right font-medium text-amber-400">{fmt(listing.revenueCents)}</td>
              <td className="px-5 py-3 text-right text-slate-300">{listing.orderCount}</td>
              <td className="px-5 py-3 text-right text-slate-400">{listing.viewCount ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Reviews section ───────────────────────────────────────────────────────────

function ReviewsSection() {
  const { data, isLoading, isError } = useSellerReviewsSummary();

  if (isLoading) return <Skeleton className="h-48" />;
  if (isError || !data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 h-32 flex items-center justify-center">
        <p className="text-sm text-slate-500">No review data yet.</p>
      </div>
    );
  }

  const summary = data as SellerReviewsSummary;
  const distribution = (summary as any).ratingDistribution as Record<string, number> | undefined;
  const distData = distribution
    ? [5, 4, 3, 2, 1].map((star) => ({ star: `${star}★`, count: distribution[String(star)] ?? 0 }))
    : [];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Reviews</h3>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-amber-400">
            {summary.averageRating?.toFixed(1) ?? '—'}
          </span>
          <span className="text-xs text-slate-500">
            avg · {summary.reviewCount ?? 0} reviews
          </span>
        </div>
      </div>

      {distData.length > 0 && (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={distData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="star" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [v, 'Reviews']}
            />
            <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function AnalyticsView() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const groupBy = PERIODS.find((p) => p.value === period)?.groupBy ?? 'day';
  const { data: overview, isLoading: overviewLoading } = useSellerAnalyticsOverview(period);

  return (
    <div className="space-y-6">
      {/* Header row with period toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Seller Analytics</p>
          <h1 className="text-2xl font-semibold">Performance</h1>
        </div>
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      {/* KPI cards */}
      {overviewLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Revenue" value={fmt(overview.totalRevenueCents)} accent />
          <StatCard label="Orders" value={overview.totalOrders} />
          <StatCard label="Completed" value={overview.completedOrders} />
          <StatCard label="Avg Order" value={fmt(overview.avgOrderValueCents)} />
        </div>
      ) : null}

      {/* Revenue chart */}
      <RevenueSection period={period} groupBy={groupBy} />

      {/* Top listings + Reviews side by side on large screens */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TopListingsSection />
        <ReviewsSection />
      </div>
    </div>
  );
}
