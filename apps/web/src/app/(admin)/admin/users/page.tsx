'use client';

import { useAdminUsers } from '../../../../lib/react-query/hooks';
import type { AdminUserDetail } from '@forumo/shared';

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
  MODERATOR: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  SELLER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  BUYER: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const KYC_COLORS: Record<string, string> = {
  APPROVED: 'text-emerald-400',
  PENDING: 'text-amber-400',
  REJECTED: 'text-red-400',
  NOT_SUBMITTED: 'text-slate-500',
};

function UserRow({ user }: { user: AdminUserDetail }) {
  const roleCls = ROLE_COLORS[user.role] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  const kycCls = KYC_COLORS[user.kycStatus] ?? 'text-slate-500';

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-900/40 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-white">{user.name}</p>
          <p className="text-xs text-slate-400">{user.email}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${roleCls}`}>
          {user.role}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium ${kycCls}`}>{user.kycStatus}</span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-400">{user.listingsCount}</td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const { data: users, isLoading, isError } = useAdminUsers();

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-slate-800" />
        ))}
      </div>
    );
  }

  if (isError || !users) {
    return (
      <p className="text-sm text-red-400">Failed to load users. Make sure you have admin privileges.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Users</h2>
          <p className="text-sm text-slate-400">{users.length} total accounts</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/40">
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">User</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Role</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">KYC</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Listings</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Joined</th>
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
