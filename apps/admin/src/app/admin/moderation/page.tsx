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

export default function ModerationPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const qc = useQueryClient();

  const { data: items, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-moderation-queue'],
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-moderation-queue'] }),
  });

  // Show only items that have been flagged by the moderation service
  const [filter, setFilter] = useState<'FLAGGED' | 'PENDING' | ''>('FLAGGED');
  const flagged = items?.filter((i) => (filter ? i.moderationStatus === filter : true)) ?? [];

  const columns: Column<AdminListingModeration>[] = [
    { header: 'Title', accessor: 'title' },
    { header: 'Seller', accessor: (i) => i.seller?.name ?? '—' },
    { header: 'Mod Status', accessor: (i) => <Badge value={i.moderationStatus} /> },
    {
      header: 'Score',
      accessor: (i) => {
        const score = (i as any).moderationScore;
        return score != null ? (score as number).toFixed(2) : '—';
      },
    },
    {
      header: 'Labels',
      accessor: (i) => {
        const labels: string[] = (i as any).moderationLabels ?? [];
        return labels.length > 0 ? labels.slice(0, 3).join(', ') : '—';
      },
    },
    {
      header: 'Actions',
      accessor: (i) => (
        <div className="flex gap-2">
          <button
            onClick={() => moderate.mutate({ id: i.id, moderationStatus: 'APPROVED' })}
            disabled={moderate.isPending || i.moderationStatus === 'APPROVED'}
            className="rounded px-2 py-1 text-xs bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-40"
          >
            Approve
          </button>
          <button
            onClick={() => {
              const notes = window.prompt('Rejection reason:') ?? undefined;
              moderate.mutate({ id: i.id, moderationStatus: 'REJECTED', moderationNotes: notes });
            }}
            disabled={moderate.isPending || i.moderationStatus === 'REJECTED'}
            className="rounded px-2 py-1 text-xs bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Content Moderation"
        subtitle="Review content flagged by the automated moderation service"
      />

      <div className="mb-4 flex gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500"
        >
          <option value="FLAGGED">Flagged</option>
          <option value="PENDING">Pending</option>
          <option value="">All</option>
        </select>
        <span className="flex items-center text-sm text-gray-500">
          {flagged.length} item{flagged.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isError ? (
        <ErrorState message="Failed to load moderation queue." onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={flagged}
          keyExtractor={(i) => i.id}
          loading={isLoading}
          emptyMessage="No flagged content — queue is clear."
        />
      )}
    </div>
  );
}
