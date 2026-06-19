'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { createApiClient } from '../../../lib/api-client';
import { DataTable, Column } from '../../../components/data-table';
import { Badge } from '../../../components/badge';
import { PageHeader } from '../../../components/page-header';
import { ErrorState } from '../../../components/error-state';
import type { AdminUserDetail } from '@forumo/shared';

export default function UsersPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', search, statusFilter, roleFilter, page],
    queryFn: () =>
      createApiClient(token).admin.listUsers({
        search: search || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
        page,
        limit: 50,
      }),
    enabled: !!token,
  });

  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      createApiClient(token).admin.suspendUser(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const unsuspend = useMutation({
    mutationFn: (id: string) => createApiClient(token).admin.unsuspendUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const ban = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      createApiClient(token).admin.banUser(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const columns: Column<AdminUserDetail>[] = [
    { header: 'Name', accessor: 'name' },
    { header: 'Email', accessor: 'email' },
    { header: 'Role', accessor: (u) => <Badge value={u.role} /> },
    { header: 'Status', accessor: (u) => <Badge value={u.accountStatus} /> },
    {
      header: 'Joined',
      accessor: (u) => new Date(u.createdAt).toLocaleDateString(),
    },
    {
      header: 'Actions',
      accessor: (u) => (
        <div className="flex gap-2">
          {u.accountStatus === 'SUSPENDED' ? (
            <button
              onClick={() => unsuspend.mutate(u.id)}
              disabled={unsuspend.isPending}
              className="rounded px-2 py-1 text-xs bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50"
            >
              Unsuspend
            </button>
          ) : u.accountStatus === 'ACTIVE' ? (
            <button
              onClick={() => {
                const reason = window.prompt('Suspension reason:');
                if (reason) suspend.mutate({ id: u.id, reason });
              }}
              disabled={suspend.isPending}
              className="rounded px-2 py-1 text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200 disabled:opacity-50"
            >
              Suspend
            </button>
          ) : null}
          {u.accountStatus !== 'BANNED' && (
            <button
              onClick={() => {
                const reason = window.prompt('Ban reason:');
                if (reason && window.confirm(`Permanently ban ${u.email}?`))
                  ban.mutate({ id: u.id, reason });
              }}
              disabled={ban.isPending}
              className="rounded px-2 py-1 text-xs bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
            >
              Ban
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={`${users?.length ?? 0} user${users?.length === 1 ? '' : 's'} loaded`}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500 w-56"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
          <option value="PENDING_VERIFICATION">Pending verification</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500"
        >
          <option value="">All roles</option>
          <option value="BUYER">Buyer</option>
          <option value="SELLER">Seller</option>
          <option value="ADMIN">Admin</option>
          <option value="MODERATOR">Moderator</option>
        </select>
      </div>

      {isError ? (
        <ErrorState message="Failed to load users." onRetry={() => refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={users ?? []}
            keyExtractor={(u) => u.id}
            loading={isLoading}
            emptyMessage="No users match the current filters."
          />
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded px-3 py-1.5 text-sm border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
            >
              Previous
            </button>
            <span className="flex items-center px-2 text-sm text-gray-500">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(users?.length ?? 0) < 50}
              className="rounded px-3 py-1.5 text-sm border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
