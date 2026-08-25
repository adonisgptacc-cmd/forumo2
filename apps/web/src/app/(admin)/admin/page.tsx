"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  useAdminDashboardStats,
  AdminDashboardStats,
  useAdminUsers,
  useAdminListings,
  useAdminOrders,
  useAdminAnalytics,
  useCategories,
} from "../../../lib/react-query/hooks";
import type {
  AdminUserDetail,
  AdminListingModeration,
  AdminOrderSummary,
} from "@forumo/shared";
import { ErrorBoundary } from "../../../components/ErrorBoundary";

function downloadCsv(filename: string, rows: string[][], headers: string[]) {
  const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type DashboardStats = AdminDashboardStats;

function buildMetrics(stats: DashboardStats | null) {
  if (!stats) {
    return [
      { label: "Total users", value: "...", delta: "", tone: "emerald" },
      { label: "Active listings", value: "...", delta: "", tone: "amber" },
      { label: "Total orders", value: "...", delta: "", tone: "emerald" },
      { label: "Open disputes", value: "...", delta: "", tone: "rose" },
    ];
  }
  return [
    {
      label: "Total users",
      value: stats.totalUsers.toLocaleString(),
      delta: `${stats.pendingKyc} KYC pending`,
      tone: "emerald",
    },
    {
      label: "Active listings",
      value: stats.activeListings.toLocaleString(),
      delta: `${stats.pendingModeration} need review`,
      tone: "amber",
    },
    {
      label: "Total orders",
      value: stats.totalOrders.toLocaleString(),
      delta: "All time",
      tone: "emerald",
    },
    {
      label: "Open disputes",
      value: stats.openDisputes.toLocaleString(),
      delta: stats.openDisputes > 0 ? "Needs attention" : "All clear",
      tone: stats.openDisputes > 0 ? "rose" : "emerald",
    },
  ];
}

const CATEGORY_TONES = ["emerald", "sky", "amber", "violet", "rose", "slate"];

const reports = [
  { title: "Daily revenue", detail: "Export CSV", action: "Download" },
  {
    title: "Category performance",
    detail: "PDF, last 30 days",
    action: "Generate",
  },
  { title: "Risk review", detail: "Suspicious activity log", action: "Open" },
];

const toneStyles: Record<string, string> = {
  emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
  amber: "text-amber-700 bg-amber-50 border-amber-200",
  rose: "text-red-700 bg-red-50 border-red-200",
  sky: "text-sky-700 bg-sky-50 border-sky-200",
  violet: "text-violet-700 bg-violet-50 border-violet-200",
  slate:
    "text-[color:var(--ink-3)] bg-[color:var(--surface-2)] border-[color:var(--line)]",
};

const toneDots: Record<string, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-red-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  slate: "bg-[color:var(--line-2)]",
};

function StatusBadge({ label }: { label: string }) {
  const palette: Record<string, string> = {
    PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    CONFIRMED: "bg-sky-50 text-sky-700 border-sky-200",
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
    COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CANCELLED:
      "bg-[color:var(--surface-2)] text-[color:var(--ink-3)] border-[color:var(--line)]",
    FLAGGED: "bg-red-50 text-red-700 border-red-200",
    Flagged: "bg-red-50 text-red-700 border-red-200",
    REMOVED:
      "bg-[color:var(--surface-2)] text-[color:var(--ink-3)] border-[color:var(--line)]",
    Removed:
      "bg-[color:var(--surface-2)] text-[color:var(--ink-3)] border-[color:var(--line)]",
    SUSPENDED: "bg-red-50 text-red-700 border-red-200",
    Suspended: "bg-red-50 text-red-700 border-red-200",
    DISPUTED: "bg-orange-50 text-orange-700 border-orange-200",
    Disputed: "bg-orange-50 text-orange-700 border-orange-200",
    REFUNDED: "bg-sky-50 text-sky-700 border-sky-200",
    Refunded: "bg-sky-50 text-sky-700 border-sky-200",
    DRAFT:
      "bg-[color:var(--surface-2)] text-[color:var(--ink-3)] border-[color:var(--line)]",
    PAUSED: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs ${palette[label] ?? "bg-[color:var(--surface-2)] text-[color:var(--ink-2)] border-[color:var(--line)]"}`}
    >
      {label}
    </span>
  );
}

function LineChart({ data }: { data: { label: string; value: number }[] }) {
  if (!data || data.length < 2) {
    return (
      <div className="h-48 card flex items-center justify-center text-sm text-[color:var(--ink-3)]">
        No data yet
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  const points = data
    .map((d, idx) => {
      const x = (idx / (data.length - 1)) * 100;
      const y = 100 - (d.value / max) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="h-48 card p-4">
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="line" x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0%"
              stopColor="oklch(0.50 0.070 155)"
              stopOpacity="0.8"
            />
            <stop
              offset="100%"
              stopColor="oklch(0.50 0.070 155)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <polyline
          points={points}
          fill="none"
          stroke="oklch(0.50 0.070 155)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polygon
          points={`${points} 100,100 0,100`}
          fill="url(#line)"
          opacity="0.35"
        />
      </svg>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-[color:var(--ink-3)]">
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 card flex items-center justify-center text-sm text-[color:var(--ink-3)]">
        No data yet
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="h-48 card p-4">
      <div className="flex h-full items-end gap-3">
        {data.map((item) => (
          <div
            key={item.label}
            className="flex-1 text-center text-xs text-[color:var(--ink-3)]"
          >
            <div
              className="mx-auto w-full max-w-10 rounded-t-lg bg-sky-500"
              style={{ height: `${(item.value / max) * 100}%` }}
            />
            <p className="mt-2">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({
  data,
}: {
  data: { label: string; value: number; tone: string }[];
}) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  let accumulated = 0;

  return (
    <div className="relative h-48 w-full">
      <div
        className="h-full w-full rounded-full border border-[color:var(--line)]"
        style={{
          background: `conic-gradient(${data
            .map((item) => {
              const start = (accumulated / total) * 360;
              accumulated += item.value;
              const end = (accumulated / total) * 360;
              const colors: Record<string, string> = {
                emerald: "#34d399",
                sky: "#38bdf8",
                amber: "#f59e0b",
                violet: "#a78bfa",
                rose: "#fb7185",
                slate: "#cbd5e1",
              };
              return `${colors[item.tone] ?? "#cbd5e1"} ${start}deg ${end}deg`;
            })
            .join(", ")})`,
        }}
      />
      <div className="absolute inset-6 rounded-full bg-[color:var(--surface)] shadow-inner" />
      <div className="absolute inset-0 flex items-center justify-center text-center">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
            Categories
          </p>
          <p className="text-2xl font-semibold text-[color:var(--ink)]">
            {total}%
          </p>
          <p className="text-xs text-[color:var(--ink-3)]">
            Distribution of active listings
          </p>
        </div>
      </div>
    </div>
  );
}

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    cents / 100,
  );
}

export default function AdminHome() {
  const { data: stats = null } = useAdminDashboardStats();
  const metrics = buildMetrics(stats);
  const { data: allUsers = [] } = useAdminUsers();
  const { data: allListings = [] } = useAdminListings();
  const { data: allOrders = [] } = useAdminOrders();
  const { data: analytics } = useAdminAnalytics();
  const { data: categories = [] } = useCategories();

  const salesTrend = analytics?.salesTrend ?? [];
  const userGrowth = analytics?.userGrowth ?? [];
  const recentActivity = analytics?.recentActivity ?? [];

  const categoryPerformance = useMemo(() => {
    if (categories.length === 0) return [];
    const total = categories.length;
    return categories.slice(0, 6).map((cat, i) => ({
      label: cat.name,
      value: Math.round(((total - i) / ((total * (total + 1)) / 2)) * 100),
      tone: CATEGORY_TONES[i % CATEGORY_TONES.length],
    }));
  }, [categories]);

  const [userQuery, setUserQuery] = useState("");
  const [userRole, setUserRole] = useState("all");
  const [userKyc, setUserKyc] = useState("all");

  const [listingQuery, setListingQuery] = useState("");
  const [listingStatus, setListingStatus] = useState("all");

  const [transactionStatus, setTransactionStatus] = useState("all");

  const filteredUsers = useMemo(
    () =>
      (allUsers as AdminUserDetail[]).filter((u) => {
        const matchesQuery =
          (u.name ?? "").toLowerCase().includes(userQuery.toLowerCase()) ||
          (u.email ?? "").toLowerCase().includes(userQuery.toLowerCase());
        const matchesRole =
          userRole === "all" || u.role.toLowerCase() === userRole.toLowerCase();
        const matchesKyc =
          userKyc === "all" ||
          u.kycStatus.toLowerCase() === userKyc.toLowerCase();
        return matchesQuery && matchesRole && matchesKyc;
      }),
    [allUsers, userQuery, userRole, userKyc],
  );

  const filteredListings = useMemo(
    () =>
      (allListings as AdminListingModeration[]).filter((l) => {
        const matchesQuery = l.title
          .toLowerCase()
          .includes(listingQuery.toLowerCase());
        const matchesStatus =
          listingStatus === "all" ||
          l.status.toLowerCase() === listingStatus.toLowerCase();
        return matchesQuery && matchesStatus;
      }),
    [allListings, listingQuery, listingStatus],
  );

  const filteredTransactions = useMemo(
    () =>
      (allOrders as AdminOrderSummary[]).filter((o) =>
        transactionStatus === "all"
          ? true
          : o.status.toLowerCase() === transactionStatus.toLowerCase(),
      ),
    [allOrders, transactionStatus],
  );

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
              Marketplace overview
            </p>
            <h2 className="text-3xl font-semibold text-[color:var(--ink)]">
              Executive dashboard
            </h2>
            <p className="text-sm text-[color:var(--ink-3)]">
              Monitor marketplace health, revenue, and trust signals from a
              single control plane.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/admin/categories"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              + Add category
            </Link>
            <button
              onClick={() =>
                downloadCsv(
                  "forumo-orders.csv",
                  (filteredTransactions as AdminOrderSummary[]).map((o) => [
                    o.orderNumber,
                    o.buyerName ?? o.buyerEmail ?? "",
                    o.status,
                    o.paymentStatus,
                    String(o.totalItemCents / 100),
                    o.currency,
                    o.placedAt ?? "",
                  ]),
                  [
                    "Order #",
                    "Buyer",
                    "Status",
                    "Payment",
                    "Amount",
                    "Currency",
                    "Date",
                  ],
                )
              }
              className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--ink)] hover:border-[color:var(--accent)] hover:bg-[color:var(--surface-2)]"
            >
              Export orders CSV
            </button>
            <button
              onClick={() =>
                downloadCsv(
                  "forumo-users.csv",
                  (filteredUsers as AdminUserDetail[]).map((u) => [
                    u.name ?? "",
                    u.email ?? "",
                    u.role,
                    u.kycStatus,
                    String(u.listingsCount),
                    u.createdAt,
                  ]),
                  ["Name", "Email", "Role", "KYC", "Listings", "Registered"],
                )
              }
              className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--ink)] hover:border-[color:var(--accent)] hover:bg-[color:var(--surface-2)]"
            >
              Export users CSV
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="card p-4 shadow-lg">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
                {metric.label}
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <h3 className="text-3xl font-semibold text-[color:var(--ink)]">
                  {metric.value}
                </h3>
                <span
                  className={`rounded-full border px-2 py-1 text-xs ${toneStyles[metric.tone]}`}
                >
                  {metric.delta}
                </span>
              </div>
              <p className="mt-1 text-xs text-[color:var(--ink-3)]">
                Week-over-week change
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[2fr,1fr]">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="flex items-center justify-between pb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
                    Sales
                  </p>
                  <h3 className="text-lg text-[color:var(--ink)]">
                    Revenue trend
                  </h3>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                  Live
                </span>
              </div>
              <LineChart data={salesTrend} />
            </div>
            <div>
              <div className="flex items-center justify-between pb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
                    Users
                  </p>
                  <h3 className="text-lg text-[color:var(--ink)]">
                    New registrations
                  </h3>
                </div>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700">
                  +12% MoM
                </span>
              </div>
              <BarChart data={userGrowth} />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
                  Inventory mix
                </p>
                <h3 className="text-lg text-[color:var(--ink)]">
                  Category performance
                </h3>
              </div>
              <button className="text-xs text-[color:var(--accent)] hover:text-[color:var(--accent-2)]">
                View details →
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-[1.1fr,0.9fr]">
              <DonutChart data={categoryPerformance} />
              <div className="space-y-3 text-sm">
                {categoryPerformance.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-2)] px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${toneDots[item.tone] ?? "bg-slate-500"}`}
                      ></span>
                      <div>
                        <p className="font-medium text-[color:var(--ink)]">
                          {item.label}
                        </p>
                        <p className="text-xs text-[color:var(--ink-3)]">
                          {item.value}% of active listings
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] ${toneStyles[item.tone]}`}
                    >
                      {item.value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
                  Recent activity
                </p>
                <h3 className="text-lg text-[color:var(--ink)]">
                  Listings, purchases, registrations
                </h3>
              </div>
              <button
                onClick={() =>
                  downloadCsv(
                    "audit-log.csv",
                    recentActivity.map((a) => [a.title, a.meta, a.time]),
                    ["Event", "Detail", "Time"],
                  )
                }
                className="text-xs text-[color:var(--accent)] hover:text-[color:var(--accent-2)]"
              >
                Download audit log
              </button>
            </div>
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.title}
                  className="flex items-center justify-between rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)] px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-8 w-8 rounded-full border ${toneStyles[activity.tone]} flex items-center justify-center text-xs font-semibold`}
                    >
                      ●
                    </span>
                    <div>
                      <p className="font-medium text-[color:var(--ink)]">
                        {activity.title}
                      </p>
                      <p className="text-xs text-[color:var(--ink-3)]">
                        {activity.meta}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-[color:var(--ink-3)]">
                    {activity.time}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center justify-between pb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
                    Quick actions
                  </p>
                  <h3 className="text-lg text-[color:var(--ink)]">
                    Resolve workflows
                  </h3>
                </div>
              </div>
              <div className="space-y-2">
                <a
                  href="/admin/kyc"
                  className="flex w-full items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  Approve verified sellers{" "}
                  <span className="text-xs">
                    {stats?.pendingKyc ?? "..."} pending →
                  </span>
                </a>
                <a
                  href="/admin/moderations"
                  className="flex w-full items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  Review flagged listings{" "}
                  <span className="text-xs">
                    {stats?.pendingModeration ?? "..."} pending →
                  </span>
                </a>
                <a
                  href="/admin/disputes"
                  className="flex w-full items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 transition-colors"
                >
                  Resolve disputes{" "}
                  <span className="text-xs">
                    {stats?.openDisputes ?? "..."} open →
                  </span>
                </a>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between pb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
                    Reports
                  </p>
                  <h3 className="text-lg text-[color:var(--ink)]">
                    Analytics & exports
                  </h3>
                </div>
                <span className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface-2)] px-2 py-1 text-[11px] text-[color:var(--ink-2)]">
                  CSV, PDF
                </span>
              </div>
              <div className="space-y-3 text-sm">
                {reports.map((report) => (
                  <div
                    key={report.title}
                    className="flex items-center justify-between rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-2)] px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-[color:var(--ink)]">
                        {report.title}
                      </p>
                      <p className="text-xs text-[color:var(--ink-3)]">
                        {report.detail}
                      </p>
                    </div>
                    <button className="text-xs text-[color:var(--accent)] hover:text-[color:var(--accent-2)]">
                      {report.action} →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
                  Users
                </p>
                <h3 className="text-lg text-[color:var(--ink)]">
                  Account management
                </h3>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-[color:var(--ink-2)]">
                <input
                  className="input-forumo w-48"
                  placeholder="Search users"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                />
                <select
                  className="input-forumo w-28"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                >
                  <option value="all">All roles</option>
                  <option value="SELLER">Sellers</option>
                  <option value="BUYER">Buyers</option>
                  <option value="ADMIN">Admins</option>
                </select>
                <select
                  className="input-forumo w-32"
                  value={userKyc}
                  onChange={(e) => setUserKyc(e.target.value)}
                >
                  <option value="all">All KYC</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[color:var(--ink-3)]">
                  <tr className="border-b border-[color:var(--line)] text-[color:var(--ink-2)]">
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">KYC</th>
                    <th className="px-3 py-2">Listings</th>
                    <th className="px-3 py-2">Registered</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)] text-[color:var(--ink)]">
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-center text-[color:var(--ink-3)] text-sm"
                      >
                        No users found
                      </td>
                    </tr>
                  )}
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-[color:var(--surface-2)]"
                    >
                      <td className="px-3 py-2">
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-[color:var(--ink-3)]">
                            {u.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[color:var(--ink-2)]">
                        {u.role}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge label={u.kycStatus} />
                      </td>
                      <td className="px-3 py-2 text-[color:var(--ink-2)]">
                        {u.listingsCount}
                      </td>
                      <td className="px-3 py-2 text-[color:var(--ink-2)]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-amber-200">
                        <Link
                          href={`/admin/kyc?userId=${u.id}` as any}
                          className="hover:underline"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
                  Listings
                </p>
                <h3 className="text-lg text-[color:var(--ink)]">
                  Inventory controls
                </h3>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-[color:var(--ink-2)]">
                <input
                  className="input-forumo w-48"
                  placeholder="Search listings"
                  value={listingQuery}
                  onChange={(e) => setListingQuery(e.target.value)}
                />
                <select
                  className="input-forumo w-32"
                  value={listingStatus}
                  onChange={(e) => setListingStatus(e.target.value)}
                >
                  <option value="all">All status</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PAUSED">Paused</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[color:var(--ink-3)]">
                  <tr className="border-b border-[color:var(--line)] text-[color:var(--ink-2)]">
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Moderation</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)] text-[color:var(--ink)]">
                  {filteredListings.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-[color:var(--ink-3)] text-sm"
                      >
                        No listings found
                      </td>
                    </tr>
                  )}
                  {filteredListings.map((l) => (
                    <tr
                      key={l.id}
                      className="hover:bg-[color:var(--surface-2)]"
                    >
                      <td className="px-3 py-2 font-medium">{l.title}</td>
                      <td className="px-3 py-2">
                        <StatusBadge label={l.status} />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge label={l.moderationStatus} />
                      </td>
                      <td className="px-3 py-2 text-[color:var(--ink-2)]">
                        {new Date(l.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-amber-200">
                        {l.moderationStatus === "PENDING" ? (
                          <Link
                            href="/admin/moderations"
                            className="hover:underline"
                          >
                            Review →
                          </Link>
                        ) : (
                          <Link
                            href={`/listings/${l.id}` as any}
                            className="hover:underline"
                          >
                            View →
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
                  Transactions
                </p>
                <h3 className="text-lg text-[color:var(--ink)]">
                  Order history
                </h3>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-[color:var(--ink-2)]">
                <select
                  className="input-forumo w-32"
                  value={transactionStatus}
                  onChange={(e) => setTransactionStatus(e.target.value)}
                >
                  <option value="all">All status</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="PAID">Paid</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DISPUTED">Disputed</option>
                  <option value="REFUNDED">Refunded</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <button
                  onClick={() =>
                    downloadCsv(
                      "orders.csv",
                      (filteredTransactions as AdminOrderSummary[]).map((o) => [
                        o.orderNumber,
                        o.buyerName ?? o.buyerEmail ?? "",
                        o.status,
                        o.paymentStatus,
                        String(o.totalItemCents / 100),
                        o.currency,
                        o.placedAt ?? "",
                      ]),
                      [
                        "Order #",
                        "Buyer",
                        "Status",
                        "Payment",
                        "Amount",
                        "Currency",
                        "Date",
                      ],
                    )
                  }
                  className="btn btn-ghost btn-sm text-xs"
                >
                  Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[color:var(--ink-3)]">
                  <tr className="border-b border-[color:var(--line)] text-[color:var(--ink-2)]">
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Buyer</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)] text-[color:var(--ink)]">
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-center text-[color:var(--ink-3)] text-sm"
                      >
                        No orders found
                      </td>
                    </tr>
                  )}
                  {filteredTransactions.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-[color:var(--surface-2)]"
                    >
                      <td className="px-3 py-2 font-medium font-mono text-xs">
                        <Link
                          href={`/admin/orders/${o.id}` as any}
                          className="text-[color:var(--accent)] hover:underline"
                        >
                          #{o.orderNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-[color:var(--ink-2)]">
                        {o.buyerName ?? o.buyerEmail ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge label={o.status} />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge label={o.paymentStatus} />
                      </td>
                      <td className="px-3 py-2 text-[color:var(--ink-2)]">
                        {fmt(o.totalItemCents, o.currency)}
                      </td>
                      <td className="px-3 py-2 text-[color:var(--ink-2)]">
                        {o.placedAt
                          ? new Date(o.placedAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--ink-3)]">
                  Categories
                </p>
                <h3 className="text-lg text-[color:var(--ink)]">
                  Hierarchy management
                </h3>
              </div>
              <button className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Add subcategory
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {categoryPerformance.map((category) => (
                <div
                  key={category.label}
                  className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)] p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${toneDots[category.tone] ?? "bg-slate-500"}`}
                      ></span>
                      <p className="font-medium text-[color:var(--ink)]">
                        {category.label}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] ${toneStyles[category.tone]}`}
                    >
                      {category.value}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--ink-3)]">
                    Performance across {Math.round(category.value * 1200)}{" "}
                    listings
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-[color:var(--surface-2)]">
                    <div
                      className={`h-2 rounded-full ${toneDots[category.tone] ?? "bg-slate-500"}`}
                      style={{ width: `${category.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
