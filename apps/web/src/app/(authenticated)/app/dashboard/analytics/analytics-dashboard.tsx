"use client";

import Link from "next/link";
import { useState } from "react";
import {
  LineChart,
  Line,
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
} from "../../../../../lib/react-query/hooks";
import type { SellerRevenuePoint } from "@forumo/shared";

// ── helpers ────────────────────────────────────────────────────────────────

function formatZAR(cents: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPct(n: number) {
  return `${n > 0 ? "+" : ""}${n}%`;
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", { month: "short", day: "numeric" });
}

function downloadCSV(data: SellerRevenuePoint[], period: string) {
  const header = "Date,Revenue (ZAR),Orders,Fees (ZAR)";
  const rows = data.map(
    (r) =>
      `${r.date},${(r.revenue / 100).toFixed(2)},${r.orders},${(r.fees / 100).toFixed(2)}`,
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `revenue-${period}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── skeleton ───────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

// ── change badge ───────────────────────────────────────────────────────────

function ChangeBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-sm text-gray-400">—</span>;
  const positive = value > 0;
  return (
    <span
      className={`flex items-center gap-0.5 text-sm font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}
    >
      <span>{positive ? "↑" : "↓"}</span>
      {Math.abs(value)}%
    </span>
  );
}

// ── metric card ────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  change,
  loading,
}: {
  label: string;
  value: string;
  change?: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      {loading ? (
        <>
          <Skeleton className="mt-2 h-7 w-28" />
          <Skeleton className="mt-1 h-4 w-12" />
        </>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
          {change !== undefined && <ChangeBadge value={change} />}
        </>
      )}
    </div>
  );
}

// ── revenue tooltip ─────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as SellerRevenuePoint;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-sm">
      <p className="font-medium text-gray-700">{label}</p>
      <p className="text-emerald-600">{formatZAR(d.revenue)} revenue</p>
      <p className="text-gray-500">
        {d.orders} order{d.orders !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// ── rating bar ─────────────────────────────────────────────────────────────

function RatingBar({
  star,
  count,
  total,
}: {
  star: number;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-10 shrink-0 text-right text-gray-500">{star} ★</span>
      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-amber-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-gray-600">{count}</span>
    </div>
  );
}

// ── main component ──────────────────────────────────────────────────────────

const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");

  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
    refetch: refetchOverview,
  } = useSellerAnalyticsOverview(period);

  const groupBy = period === "90d" ? "week" : "day";
  const {
    data: revenue = [],
    isLoading: revenueLoading,
    isError: revenueError,
    refetch: refetchRevenue,
  } = useSellerAnalyticsRevenue(period, groupBy);

  const {
    data: topListings = [],
    isLoading: topLoading,
    isError: topError,
    refetch: refetchTop,
  } = useSellerTopListings(5);

  const {
    data: reviews,
    isLoading: reviewsLoading,
    isError: reviewsError,
    refetch: refetchReviews,
  } = useSellerReviewsSummary();

  return (
    <div className="space-y-8 pb-12">
      {/* header + period tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1 gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                period === p.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* metric cards */}
      {overviewError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Failed to load overview.{" "}
          <button className="underline" onClick={() => refetchOverview()}>
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="GMV"
            value={overview ? formatZAR(overview.gmv) : "—"}
            change={overview?.changes.gmvChange}
            loading={overviewLoading}
          />
          <MetricCard
            label="Total Orders"
            value={overview ? String(overview.orders) : "—"}
            change={overview?.changes.ordersChange}
            loading={overviewLoading}
          />
          <MetricCard
            label="Avg Order Value"
            value={overview ? formatZAR(overview.avgOrderValue) : "—"}
            change={overview?.changes.aovChange}
            loading={overviewLoading}
          />
          <MetricCard
            label="Conversion Rate"
            value={overview ? `${overview.conversionRate.toFixed(1)}%` : "—"}
            loading={overviewLoading}
          />
        </div>
      )}

      {/* revenue chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Revenue Over Time</h2>
          <button
            onClick={() => downloadCSV(revenue, period)}
            disabled={revenue.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            ↓ Export CSV
          </button>
        </div>

        {revenueError ? (
          <div className="flex h-48 items-center justify-center rounded-lg bg-red-50 text-sm text-red-600">
            Failed to load revenue data.{" "}
            <button className="ml-1 underline" onClick={() => refetchRevenue()}>
              Retry
            </button>
          </div>
        ) : revenueLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-48 w-full" />
          </div>
        ) : revenue.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-gray-400">
            No revenue data for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={revenue}
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => `R${(v / 100).toFixed(0)}`}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#10b981" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* top listings + reviews side by side on desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* top listings */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Top 5 Listings</h2>

          {topError ? (
            <div className="text-sm text-red-600">
              Failed to load.{" "}
              <button className="underline" onClick={() => refetchTop()}>
                Retry
              </button>
            </div>
          ) : topLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : topListings.length === 0 ? (
            <p className="text-sm text-gray-400">No sales yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400">
                    <th className="pb-2 text-left font-medium">Listing</th>
                    <th className="pb-2 text-right font-medium">Orders</th>
                    <th className="pb-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topListings.map((l) => (
                    <tr
                      key={l.listingId}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="py-2.5 pr-4">
                        <Link
                          href={`/listings/${l.listingId}` as any}
                          className="flex items-center gap-2.5 hover:opacity-80"
                        >
                          {l.thumbnailUrl ? (
                            <img
                              src={l.thumbnailUrl}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-md object-cover"
                            />
                          ) : (
                            <div className="h-9 w-9 shrink-0 rounded-md bg-gray-100" />
                          )}
                          <span className="line-clamp-1 font-medium text-gray-800">
                            {l.title}
                          </span>
                        </Link>
                      </td>
                      <td className="py-2.5 text-right text-gray-600">
                        {l.orders}
                      </td>
                      <td className="py-2.5 text-right font-medium text-gray-900">
                        {formatZAR(l.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* rating distribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-gray-900">Ratings</h2>

          {reviewsError ? (
            <div className="text-sm text-red-600">
              Failed to load.{" "}
              <button className="underline" onClick={() => refetchReviews()}>
                Retry
              </button>
            </div>
          ) : reviewsLoading ? (
            <div className="space-y-3 pt-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : !reviews || reviews.totalReviews === 0 ? (
            <p className="pt-4 text-sm text-gray-400">No reviews yet.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-gray-500">
                {reviews.totalReviews} review
                {reviews.totalReviews !== 1 ? "s" : ""} ·{" "}
                <span className="font-medium text-amber-500">
                  {reviews.avgRating.toFixed(1)} ★
                </span>
              </p>
              <div className="space-y-2.5">
                {([5, 4, 3, 2, 1] as const).map((star) => (
                  <RatingBar
                    key={star}
                    star={star}
                    count={reviews.ratingDistribution[star]}
                    total={reviews.totalReviews}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
