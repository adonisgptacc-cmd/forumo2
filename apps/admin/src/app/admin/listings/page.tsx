'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { createApiClient } from '../../../lib/api-client';
import { DataTable, Column } from '../../../components/data-table';
import { Badge } from '../../../components/badge';
import { PageHeader } from '../../../components/page-header';
import { ErrorState } from '../../../components/error-state';
import type { AdminListingModeration } from '@forumo/shared';

export default function ListingsPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');

  const { data: listings, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-listings'],
    queryFn: () => createApiClient(token).admin.listListingsForReview(),
    enabled: !!token,
  });

  const moderate = useMutation({
    mutationFn: ({
      id,
      moderationStatus,
      moderationNotes,
    }: {
      id: string;
      moderationStatus: AdminListingModeration['moderationStatus'];
      moderationNotes?: string;
    }) => createApiClient(token).admin.moderateListing(id, { moderationStatus, moderationNotes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-listings'] }),
  });

  const filtered = listings?.filter((l) =>
    statusFilter ? l.moderationStatus === statusFilter : true,
  ) ?? [];

  const columns: Column<AdminListingModeration>[] = [
    { header: 'Title', accessor: 'title' },
    { header: 'Seller', accessor: (l) => l.seller?.name ?? '—' },
    { header: 'Status', accessor: (l) => <Badge value={l.status} /> },
    { header: 'Mod Status', accessor: (l) => <Badge value={l.moderationStatus} /> },
    {
      header: 'Listed',
      accessor: (l) => new Date(l.createdAt).toLocaleDateString(),
    },
    {
      header: 'Actions',
      accessor: (l) => (
        <div className="flex gap-2">
          {l.moderationStatus !== 'APPROVED' && (
            <button
              onClick={() => moderate.mutate({ id: l.id, moderationStatus: 'APPROVED' })}
              disabled={moderate.isPending}
              className="rounded px-2 py-1 text-xs bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50"
            >
              Approve
            </button>
          )}
          {l.moderationStatus !== 'REJECTED' && (
            <button
              onClick={() => {
                const notes = window.prompt('Rejection reason (optional):') ?? undefined;
                moderate.mutate({ id: l.id, moderationStatus: 'REJECTED', moderationNotes: notes });
              }}
              disabled={moderate.isPending}
              className="rounded px-2 py-1 text-xs bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
            >
              Reject
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Listings" subtitle="Review and moderate marketplace listings" />

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500"
        >
          <option value="">All moderation statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="FLAGGED">Flagged</option>
        </select>
      </div>

      {isError ? (
        <ErrorState message="Failed to load listings." onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          keyExtractor={(l) => l.id}
          loading={isLoading}
          emptyMessage="No listings match the current filter."
        />
      )}
    </div>
  );
}
