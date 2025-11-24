"use client";

import { useMemo, useState } from "react";

const metrics = [
  { label: "Total users", value: "128,940", delta: "+3.2%", tone: "emerald" },
  { label: "Active listings", value: "42,380", delta: "+1.8%", tone: "amber" },
  { label: "Completed transactions", value: "287,451", delta: "+5.6%", tone: "emerald" },
  { label: "Revenue", value: "$12.4M", delta: "+4.1%", tone: "emerald" },
];

const salesTrend = [
  { label: "Mon", value: 42000 },
  { label: "Tue", value: 51000 },
  { label: "Wed", value: 47000 },
  { label: "Thu", value: 58000 },
  { label: "Fri", value: 61000 },
  { label: "Sat", value: 72000 },
  { label: "Sun", value: 69000 },
];

const userGrowth = [
  { label: "Jan", value: 2100 },
  { label: "Feb", value: 2400 },
  { label: "Mar", value: 2600 },
  { label: "Apr", value: 3000 },
  { label: "May", value: 3400 },
  { label: "Jun", value: 3800 },
];

const categoryPerformance = [
  { label: "Electronics", value: 32, tone: "emerald" },
  { label: "Fashion", value: 21, tone: "sky" },
  { label: "Home", value: 17, tone: "amber" },
  { label: "Collectibles", value: 12, tone: "violet" },
  { label: "Motors", value: 9, tone: "rose" },
  { label: "Other", value: 9, tone: "slate" },
];

const recentActivity = [
  { title: "New seller verification", meta: "KYC approved for @aurora-trends", time: "3m ago", tone: "emerald" },
  { title: "Listing flagged", meta: "Vintage watch - counterfeit concern", time: "12m ago", tone: "amber" },
  { title: "High-value sale", meta: "$4,200 for custom PC build", time: "28m ago", tone: "emerald" },
  { title: "Dispute opened", meta: "Order #48219 - item not received", time: "41m ago", tone: "rose" },
  { title: "New buyer", meta: "Account created: @urbanpicker", time: "58m ago", tone: "sky" },
];

const users = [
  { name: "Amelia Chen", role: "Seller", status: "Active", registered: "2024-08-12", listings: 142, country: "US" },
  { name: "Diego Martinez", role: "Buyer", status: "Pending", registered: "2024-09-01", listings: 0, country: "MX" },
  { name: "Sofia Rossi", role: "Seller", status: "Active", registered: "2024-07-05", listings: 89, country: "IT" },
  { name: "Hannah Lee", role: "Buyer", status: "Flagged", registered: "2024-06-14", listings: 0, country: "KR" },
  { name: "Marcus Holt", role: "Seller", status: "Suspended", registered: "2024-08-29", listings: 37, country: "GB" },
];

const listings = [
  { title: "Refurbished MacBook Pro 14" , category: "Electronics", status: "Active", price: "$1,350", seller: "@revive-tech", flagged: false },
  { title: "Designer Leather Tote", category: "Fashion", status: "Pending", price: "$410", seller: "@atelier-studio", flagged: false },
  { title: "Signed Baseball Card", category: "Collectibles", status: "Flagged", price: "$920", seller: "@memorabilia", flagged: true },
  { title: "Modular Sofa Set", category: "Home", status: "Active", price: "$2,480", seller: "@loft-living", flagged: false },
  { title: "Carbon Road Bike", category: "Motors", status: "Removed", price: "$3,900", seller: "@velohaus", flagged: true },
];

const transactions = [
  { id: "48291", buyer: "@urbanpicker", amount: "$420.00", status: "Completed", method: "Card", date: "Sep 14" },
  { id: "48276", buyer: "@aurora-trends", amount: "$1,120.00", status: "Pending", method: "PayPal", date: "Sep 14" },
  { id: "48255", buyer: "@memorabilia", amount: "$920.00", status: "Disputed", method: "Card", date: "Sep 13" },
  { id: "48241", buyer: "@loft-living", amount: "$2,480.00", status: "Completed", method: "Wire", date: "Sep 13" },
  { id: "48230", buyer: "@velohaus", amount: "$3,900.00", status: "Refunded", method: "Card", date: "Sep 12" },
];

const reports = [
  { title: "Daily revenue", detail: "Export CSV", action: "Download" },
  { title: "Category performance", detail: "PDF, last 30 days", action: "Generate" },
  { title: "Risk review", detail: "Suspicious activity log", action: "Open" },
];

const toneStyles: Record<string, string> = {
  emerald: "text-emerald-200 bg-emerald-400/10 border-emerald-400/40",
  amber: "text-amber-200 bg-amber-400/10 border-amber-400/40",
  rose: "text-rose-200 bg-rose-400/10 border-rose-400/40",
  sky: "text-sky-200 bg-sky-400/10 border-sky-400/40",
  violet: "text-violet-200 bg-violet-400/10 border-violet-400/40",
  slate: "text-slate-200 bg-slate-400/10 border-slate-400/30",
};

const toneDots: Record<string, string> = {
  emerald: "bg-emerald-300",
  amber: "bg-amber-300",
  rose: "bg-rose-300",
  sky: "bg-sky-300",
  violet: "bg-violet-300",
  slate: "bg-slate-300",
};

function StatusBadge({ label }: { label: string }) {
  const palette: Record<string, string> = {
    Active: "bg-emerald-500/15 text-emerald-100 border-emerald-500/40",
    Pending: "bg-amber-500/15 text-amber-100 border-amber-500/40",
    Completed: "bg-emerald-500/15 text-emerald-100 border-emerald-500/40",
    Flagged: "bg-rose-500/15 text-rose-100 border-rose-500/40",
    Removed: "bg-slate-500/15 text-slate-100 border-slate-500/40",
    Suspended: "bg-rose-500/15 text-rose-100 border-rose-500/40",
    Disputed: "bg-amber-500/15 text-amber-100 border-amber-500/40",
    Refunded: "bg-sky-500/15 text-sky-100 border-sky-500/40",
  };

  return <span className={`rounded-full border px-2.5 py-1 text-xs ${palette[label] ?? "bg-slate-700 text-slate-200"}`}>{label}</span>;
}

function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value));
  const points = data
    .map((d, idx) => {
      const x = (idx / (data.length - 1)) * 100;
      const y = 100 - (d.value / max) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="h-48 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="line" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={points}
          fill="none"
          stroke="#34d399"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polygon points={`${points} 100,100 0,100`} fill="url(#line)" opacity="0.35" />
      </svg>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-slate-400">
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="h-48 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex h-full items-end gap-3">
        {data.map((item) => (
          <div key={item.label} className="flex-1 text-center text-xs text-slate-400">
            <div
              className="mx-auto w-full max-w-10 rounded-t-lg bg-sky-400/70"
              style={{ height: `${(item.value / max) * 100}%` }}
            />
            <p className="mt-2">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ data }: { data: { label: string; value: number; tone: string }[] }) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  let accumulated = 0;

  return (
    <div className="relative h-48 w-full">
      <div
        className="h-full w-full rounded-full border border-slate-800"
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
      <div className="absolute inset-6 rounded-full bg-slate-950/90 shadow-inner" />
      <div className="absolute inset-0 flex items-center justify-center text-center">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Categories</p>
          <p className="text-2xl font-semibold text-slate-50">{total}%</p>
          <p className="text-xs text-slate-400">Distribution of active listings</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminHome() {
  const [userQuery, setUserQuery] = useState("");
  const [userRole, setUserRole] = useState("all");
  const [userStatus, setUserStatus] = useState("all");

  const [listingQuery, setListingQuery] = useState("");
  const [listingCategory, setListingCategory] = useState("all");
  const [listingStatus, setListingStatus] = useState("all");

  const [transactionStatus, setTransactionStatus] = useState("all");

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const matchesQuery = user.name.toLowerCase().includes(userQuery.toLowerCase());
        const matchesRole = userRole === "all" || user.role.toLowerCase() === userRole;
        const matchesStatus = userStatus === "all" || user.status.toLowerCase() === userStatus;
        return matchesQuery && matchesRole && matchesStatus;
      }),
    [userQuery, userRole, userStatus],
  );

  const filteredListings = useMemo(
    () =>
      listings.filter((listing) => {
        const matchesQuery = listing.title.toLowerCase().includes(listingQuery.toLowerCase());
        const matchesCategory = listingCategory === "all" || listing.category.toLowerCase() === listingCategory;
        const matchesStatus = listingStatus === "all" || listing.status.toLowerCase() === listingStatus;
        return matchesQuery && matchesCategory && matchesStatus;
      }),
    [listingQuery, listingCategory, listingStatus],
  );

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((txn) =>
        transactionStatus === "all" ? true : txn.status.toLowerCase() === transactionStatus,
      ),
    [transactionStatus],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Marketplace overview</p>
          <h2 className="text-3xl font-semibold text-white">Executive dashboard</h2>
          <p className="text-sm text-slate-400">
            Monitor marketplace health, revenue, and trust signals from a single control plane.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <button className="rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-emerald-100 hover:bg-emerald-500/20">
            + Add category
          </button>
          <button className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 hover:border-amber-400/60 hover:bg-slate-900/80">
            Export report
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-lg">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{metric.label}</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <h3 className="text-3xl font-semibold text-white">{metric.value}</h3>
              <span className={`rounded-full border px-2 py-1 text-xs ${toneStyles[metric.tone]}`}>{metric.delta}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Week-over-week change</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr,1fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Sales</p>
                <h3 className="text-lg text-white">Revenue trend</h3>
              </div>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">Live</span>
            </div>
            <LineChart data={salesTrend} />
          </div>
          <div>
            <div className="flex items-center justify-between pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Users</p>
                <h3 className="text-lg text-white">New registrations</h3>
              </div>
              <span className="rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs text-sky-100">+12% MoM</span>
            </div>
            <BarChart data={userGrowth} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between pb-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Inventory mix</p>
              <h3 className="text-lg text-white">Category performance</h3>
            </div>
            <button className="text-xs text-amber-200 hover:text-amber-100">View details →</button>
          </div>
          <div className="grid gap-4 md:grid-cols-[1.1fr,0.9fr]">
            <DonutChart data={categoryPerformance} />
            <div className="space-y-3 text-sm">
              {categoryPerformance.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${toneDots[item.tone] ?? "bg-slate-500"}`}></span>
                    <div>
                      <p className="font-medium text-slate-100">{item.label}</p>
                      <p className="text-xs text-slate-400">{item.value}% of active listings</p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${toneStyles[item.tone]}`}>{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Recent activity</p>
              <h3 className="text-lg text-white">Listings, purchases, registrations</h3>
            </div>
            <button className="text-xs text-amber-200 hover:text-amber-100">Download audit log</button>
          </div>
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div
                key={activity.title}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-8 w-8 rounded-full border ${toneStyles[activity.tone]} flex items-center justify-center text-xs font-semibold`}>
                    ●
                  </span>
                  <div>
                    <p className="font-medium text-slate-100">{activity.title}</p>
                    <p className="text-xs text-slate-400">{activity.meta}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{activity.time}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Quick actions</p>
                <h3 className="text-lg text-white">Resolve workflows</h3>
              </div>
            </div>
            <div className="space-y-2">
              <button className="flex w-full items-center justify-between rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50">
                Approve verified sellers <span className="text-xs">Process 8 →</span>
              </button>
              <button className="flex w-full items-center justify-between rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-50">
                Review flagged listings <span className="text-xs">12 pending →</span>
              </button>
              <button className="flex w-full items-center justify-between rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-50">
                Resolve disputes <span className="text-xs">4 escalations →</span>
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Reports</p>
                <h3 className="text-lg text-white">Analytics & exports</h3>
              </div>
              <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300">CSV, PDF</span>
            </div>
            <div className="space-y-3 text-sm">
              {reports.map((report) => (
                <div key={report.title} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <div>
                    <p className="font-medium text-slate-100">{report.title}</p>
                    <p className="text-xs text-slate-400">{report.detail}</p>
                  </div>
                  <button className="text-xs text-amber-200 hover:text-amber-100">{report.action} →</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Users</p>
              <h3 className="text-lg text-white">Account management</h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <input
                className="input w-48 border-slate-800 bg-slate-950/60"
                placeholder="Search users"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
              />
              <select
                className="input w-28 border-slate-800 bg-slate-950/60"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
              >
                <option value="all">All roles</option>
                <option value="seller">Sellers</option>
                <option value="buyer">Buyers</option>
              </select>
              <select
                className="input w-32 border-slate-800 bg-slate-950/60"
                value={userStatus}
                onChange={(e) => setUserStatus(e.target.value)}
              >
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="flagged">Flagged</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-800 text-slate-300">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Listings</th>
                  <th className="px-3 py-2">Registered</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.name} className="hover:bg-slate-900/60">
                    <td className="px-3 py-2">
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-slate-400">{user.country}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{user.role}</td>
                    <td className="px-3 py-2">
                      <StatusBadge label={user.status} />
                    </td>
                    <td className="px-3 py-2 text-slate-300">{user.listings}</td>
                    <td className="px-3 py-2 text-slate-300">{user.registered}</td>
                    <td className="px-3 py-2 text-right text-xs text-amber-200">Manage →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Listings</p>
              <h3 className="text-lg text-white">Inventory controls</h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <input
                className="input w-48 border-slate-800 bg-slate-950/60"
                placeholder="Search listings"
                value={listingQuery}
                onChange={(e) => setListingQuery(e.target.value)}
              />
              <select
                className="input w-32 border-slate-800 bg-slate-950/60"
                value={listingCategory}
                onChange={(e) => setListingCategory(e.target.value)}
              >
                <option value="all">All categories</option>
                <option value="electronics">Electronics</option>
                <option value="fashion">Fashion</option>
                <option value="collectibles">Collectibles</option>
                <option value="home">Home</option>
                <option value="motors">Motors</option>
              </select>
              <select
                className="input w-32 border-slate-800 bg-slate-950/60"
                value={listingStatus}
                onChange={(e) => setListingStatus(e.target.value)}
              >
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="flagged">Flagged</option>
                <option value="removed">Removed</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-800 text-slate-300">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Seller</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-100">
                {filteredListings.map((listing) => (
                  <tr key={listing.title} className="hover:bg-slate-900/60">
                    <td className="px-3 py-2">{listing.title}</td>
                    <td className="px-3 py-2 text-slate-300">{listing.category}</td>
                    <td className="px-3 py-2">
                      <StatusBadge label={listing.status} />
                    </td>
                    <td className="px-3 py-2 text-slate-300">{listing.price}</td>
                    <td className="px-3 py-2 text-slate-300">{listing.seller}</td>
                    <td className="px-3 py-2 text-right text-xs text-amber-200">
                      {listing.flagged ? "Review" : "Flag"} →
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Transactions</p>
              <h3 className="text-lg text-white">Order history</h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <select
                className="input w-32 border-slate-800 bg-slate-950/60"
                value={transactionStatus}
                onChange={(e) => setTransactionStatus(e.target.value)}
              >
                <option value="all">All status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="disputed">Disputed</option>
                <option value="refunded">Refunded</option>
              </select>
              <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-amber-400/60">
                Export CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-800 text-slate-300">
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Buyer</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-100">
                {filteredTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-900/60">
                    <td className="px-3 py-2 font-medium">#{txn.id}</td>
                    <td className="px-3 py-2 text-slate-300">{txn.buyer}</td>
                    <td className="px-3 py-2">
                      <StatusBadge label={txn.status} />
                    </td>
                    <td className="px-3 py-2 text-slate-300">{txn.method}</td>
                    <td className="px-3 py-2 text-slate-300">{txn.amount}</td>
                    <td className="px-3 py-2 text-slate-300">{txn.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Categories</p>
              <h3 className="text-lg text-white">Hierarchy management</h3>
            </div>
            <button className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              Add subcategory
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {categoryPerformance.map((category) => (
              <div key={category.label} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${toneDots[category.tone] ?? "bg-slate-500"}`}></span>
                    <p className="font-medium text-slate-100">{category.label}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${toneStyles[category.tone]}`}>{category.value}%</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">Performance across {Math.round(category.value * 1200)} listings</p>
                <div className="mt-2 h-2 rounded-full bg-slate-800">
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
  );
}
