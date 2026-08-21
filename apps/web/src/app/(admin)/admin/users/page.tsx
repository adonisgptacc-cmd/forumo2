"use client";

import { useAdminUsers } from "../../../../lib/react-query/hooks";
import type { AdminUserDetail } from "@forumo/shared";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-50 text-red-700 border-red-200",
  MODERATOR: "bg-amber-50 text-amber-700 border-amber-200",
  SELLER: "bg-blue-50 text-blue-700 border-blue-200",
  BUYER:
    "bg-[color:var(--surface-2)] text-[color:var(--ink-3)] border-[color:var(--line)]",
};

const KYC_COLORS: Record<string, string> = {
  APPROVED: "text-[color:var(--escrow)]",
  PENDING: "text-amber-700",
  REJECTED: "text-red-600",
  NOT_SUBMITTED: "text-[color:var(--ink-3)]",
};

function UserRow({ user }: { user: AdminUserDetail }) {
  const roleCls =
    ROLE_COLORS[user.role] ??
    "bg-[color:var(--surface-2)] text-[color:var(--ink-3)] border-[color:var(--line)]";
  const kycCls = KYC_COLORS[user.kycStatus] ?? "text-[color:var(--ink-3)]";

  return (
    <tr className="border-b border-[color:var(--line)] hover:bg-[color:var(--surface-2)] transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[color:var(--ink)]">
            {user.name}
          </p>
          <p className="text-xs muted">{user.email}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${roleCls}`}
        >
          {user.role}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium ${kycCls}`}>
          {user.kycStatus}
        </span>
      </td>
      <td className="px-4 py-3 text-sm muted">{user.listingsCount}</td>
      <td className="px-4 py-3 text-xs muted">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const { data: users, isLoading, isError } = useAdminUsers();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-12" />
        ))}
      </div>
    );
  }

  if (isError || !users) {
    return (
      <p className="text-sm text-red-600">
        Failed to load users. Make sure you have admin privileges.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">
            Users
          </h2>
          <p className="text-sm muted">{users.length} total accounts</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--line)]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[color:var(--line)] bg-[color:var(--surface-2)]">
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[color:var(--ink-3)]">
                User
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[color:var(--ink-3)]">
                Role
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[color:var(--ink-3)]">
                KYC
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[color:var(--ink-3)]">
                Listings
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[color:var(--ink-3)]">
                Joined
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
