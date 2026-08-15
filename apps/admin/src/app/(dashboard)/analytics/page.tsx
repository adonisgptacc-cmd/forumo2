"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { createApiClient } from "../../../lib/api-client";
import { PageHeader } from "../../../components/page-header";
import { ErrorState } from "../../../components/error-state";

function BarChart({
  data,
  maxValue,
}: {
  data: Array<{ label: string; value: number }>;
  maxValue: number;
}) {
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((point) => {
        const pct = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
        return (
          <div
            key={point.label}
            className="flex flex-col items-center gap-1 flex-1 min-w-0"
          >
            <span className="text-xs text-gray-500 truncate">
              {point.value > 0 ? (point.value / 100).toFixed(0) : "0"}
            </span>
            <div
              className="w-full bg-indigo-500 rounded-t transition-all"
              style={{ height: `${Math.max(pct, 2)}%` }}
            />
            <span className="text-xs text-gray-400">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function UserGrowthChart({
  data,
  maxValue,
}: {
  data: Array<{ label: string; value: number }>;
  maxValue: number;
}) {
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((point) => {
        const pct = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
        return (
          <div
            key={point.label}
            className="flex flex-col items-center gap-1 flex-1 min-w-0"
          >
            <span className="text-xs text-gray-500">{point.value}</span>
            <div
              className="w-full bg-emerald-500 rounded-t transition-all"
              style={{ height: `${Math.max(pct, 2)}%` }}
            />
            <span className="text-xs text-gray-400">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

const toneClasses: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-700",
};

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => createApiClient(token).admin.getAnalytics(),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const maxRevenue = Math.max(
    ...(data?.salesTrend.map((p) => p.value) ?? [0]),
    1,
  );
  const maxUsers = Math.max(
    ...(data?.userGrowth.map((p) => p.value) ?? [0]),
    1,
  );

  const totalRevenue =
    (data?.salesTrend.reduce((s, p) => s + p.value, 0) ?? 0) / 100;
  const totalNewUsers = data?.userGrowth.reduce((s, p) => s + p.value, 0) ?? 0;

  if (isError) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Platform-wide metrics" />
        <ErrorState
          message="Failed to load analytics."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Platform-wide metrics (auto-refreshes every 60 s)"
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Revenue (last 7 days)</p>
          {isLoading ? (
            <div className="mt-1 h-8 w-24 animate-pulse rounded bg-gray-100" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {totalRevenue.toLocaleString("en-US", {
                style: "currency",
                currency: data?.currency ?? "USD",
                maximumFractionDigits: 0,
              })}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">New users (last 6 months)</p>
          {isLoading ? (
            <div className="mt-1 h-8 w-16 animate-pulse rounded bg-gray-100" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {totalNewUsers.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Daily revenue (ZAR cents → ZAR)
          </h3>
          {isLoading ? (
            <div className="h-32 animate-pulse rounded bg-gray-100" />
          ) : (
            <BarChart data={data!.salesTrend} maxValue={maxRevenue} />
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            User registrations (monthly)
          </h3>
          {isLoading ? (
            <div className="h-32 animate-pulse rounded bg-gray-100" />
          ) : (
            <UserGrowthChart data={data!.userGrowth} maxValue={maxUsers} />
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">
          Recent activity
        </h3>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {(data?.recentActivity ?? []).map((item, i) => (
              <li key={i} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses[item.tone] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {item.title}
                  </span>
                  <span className="text-sm text-gray-600 truncate max-w-xs">
                    {item.meta}
                  </span>
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-4">
                  {item.time}
                </span>
              </li>
            ))}
            {(data?.recentActivity ?? []).length === 0 && (
              <li className="py-4 text-center text-sm text-gray-400">
                No recent activity
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
