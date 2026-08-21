"use client";

import { useState } from "react";
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
} from "recharts";
import {
  useSellerAnalyticsOverview,
  useSellerAnalyticsRevenue,
  useSellerTopListings,
  useSellerReviewsSummary,
  type AnalyticsPeriod,
  type AnalyticsGroupBy,
} from "../../../../lib/react-query/hooks";
import type {
  SellerTopListing,
  SellerRevenuePoint,
  SellerReviewsSummary,
} from "@forumo/shared";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// ── Period selector ───────────────────────────────────────────────────────────

const PERIODS: {
  value: AnalyticsPeriod;
  label: string;
  groupBy: AnalyticsGroupBy;
}[] = [
  { value: "7d", label: "7 days", groupBy: "day" },
  { value: "30d", label: "30 days", groupBy: "day" },
  { value: "90d", label: "90 days", groupBy: "week" },
];

function PeriodToggle({
  value,
  onChange,
}: {
  value: AnalyticsPeriod;
  onChange: (p: AnalyticsPeriod) => void;
}) {
  return (
    <div className="flex rounded-lg border border-[color:var(--line-2)] overflow-hidden">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            value === p.value
              ? "bg-[color:var(--accent)] text-white"
              : "text-[color:var(--ink-3)] hover:bg-[color:var(--surface-2)]"
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
  return <div className={`skeleton rounded-xl ${className ?? ""}`} />;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl card p-4 space-y-1">
      <p className="text-xs text-[color:var(--ink-3)]">{label}</p>
      <p
        className={`text-xl font-semibold ${accent ? "text-[color:var(--accent)]" : "text-[color:var(--ink)]"}`}
      >
        {value}
      </p>
    </div>
  );
}

// ── Revenue section ───────────────────────────────────────────────────────────

function RevenueSection({
  period,
  groupBy,
}: {
  period: AnalyticsPeriod;
  groupBy: AnalyticsGroupBy;
}) {
  const { data, isLoading, isError } = useSellerAnalyticsRevenue(
    period,
    groupBy,
  );

  if (isLoading) return <Skeleton className="h-64" />;
  if (isError || !data?.length) {
    return (
      <div className="rounded-xl card p-5 h-64 flex items-center justify-center">
        <p className="text-sm text-[color:var(--ink-3)]">
          No revenue data for this period.
        </p>
      </div>
    );
  }

  const chartData = data.map((point: SellerRevenuePoint) => ({
    label: point.date,
    revenue: point.revenue / 100,
    orders: point.orders,
  }));

  return (
    <div className="rounded-xl card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-[color:var(--ink-2)]">
        Revenue
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#ece6da" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} />
          <YAxis
            tick={{ fontSize: 10, fill: "#64748b" }}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e5e0d4",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => [
              `$${Number(value ?? 0).toLocaleString()}`,
              "Revenue",
            ]}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#c2683a"
            strokeWidth={2}
            dot={false}
          />
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
      <div className="rounded-xl card p-5 h-32 flex items-center justify-center">
        <p className="text-sm text-[color:var(--ink-3)]">
          No listing data yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl card overflow-hidden">
      <div className="px-5 py-3 border-b border-[color:var(--line)]">
        <h3 className="text-sm font-semibold text-[color:var(--ink-2)]">
          Top Listings
        </h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[color:var(--line)] text-xs text-[color:var(--ink-3)] uppercase tracking-wide">
            <th className="px-5 py-2 text-left">Listing</th>
            <th className="px-5 py-2 text-right">Revenue</th>
            <th className="px-5 py-2 text-right">Orders</th>
            <th className="px-5 py-2 text-right">Views</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--line)]">
          {data.map((listing: SellerTopListing) => (
            <tr
              key={listing.listingId}
              className="hover:bg-[color:var(--surface-2)] transition-colors"
            >
              <td className="px-5 py-3 text-[color:var(--ink-2)] truncate max-w-[200px]">
                {listing.title}
              </td>
              <td className="px-5 py-3 text-right font-medium text-[color:var(--accent)]">
                {fmt(listing.revenue)}
              </td>
              <td className="px-5 py-3 text-right text-[color:var(--ink-2)]">
                {listing.orders}
              </td>
              <td className="px-5 py-3 text-right text-[color:var(--ink-3)]">
                {listing.views ?? "—"}
              </td>
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
      <div className="rounded-xl card p-5 h-32 flex items-center justify-center">
        <p className="text-sm text-[color:var(--ink-3)]">No review data yet.</p>
      </div>
    );
  }

  const summary = data as SellerReviewsSummary;
  const distribution = (summary as any).ratingDistribution as
    Record<string, number> | undefined;
  const distData = distribution
    ? [5, 4, 3, 2, 1].map((star) => ({
        star: `${star}★`,
        count: distribution[String(star)] ?? 0,
      }))
    : [];

  return (
    <div className="rounded-xl card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[color:var(--ink-2)]">
          Reviews
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-[color:var(--accent)]">
            {summary.avgRating?.toFixed(1) ?? "—"}
          </span>
          <span className="text-xs text-[color:var(--ink-3)]">
            avg · {summary.totalReviews ?? 0} reviews
          </span>
        </div>
      </div>

      {distData.length > 0 && (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart
            data={distData}
            margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ece6da" />
            <XAxis dataKey="star" tick={{ fontSize: 10, fill: "#64748b" }} />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748b" }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #e5e0d4",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v) => [Number(v ?? 0), "Reviews"]}
            />
            <Bar dataKey="count" fill="#c2683a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function AnalyticsView() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const groupBy = PERIODS.find((p) => p.value === period)?.groupBy ?? "day";
  const { data: overview, isLoading: overviewLoading } =
    useSellerAnalyticsOverview(period);

  return (
    <div className="space-y-6">
      {/* Header row with period toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
            Seller Analytics
          </p>
          <h1 className="text-2xl font-semibold">Performance</h1>
        </div>
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      {/* KPI cards */}
      {overviewLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Revenue" value={fmt(overview.gmv)} accent />
          <StatCard label="Orders" value={overview.orders} />
          <StatCard
            label="Conversion"
            value={`${overview.conversionRate ?? 0}%`}
          />
          <StatCard label="Avg Order" value={fmt(overview.avgOrderValue)} />
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
