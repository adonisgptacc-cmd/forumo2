'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { createApiClient } from '../../../lib/api-client';
import { DataTable, Column } from '../../../components/data-table';
import { Badge } from '../../../components/badge';
import { PageHeader } from '../../../components/page-header';
import { ErrorState } from '../../../components/error-state';
import type { AdminDisputeSummary } from '@forumo/shared';

export default function DisputesPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [selected, setSelected] = useState<AdminDisputeSummary | null>(null);

  const { data: disputes, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: () => createApiClient(token).admin.listDisputes(),
    enabled: !!token,
  });

  const resolve = useMutation({
    mutationFn: ({
      id,
      status,
      resolution,
    }: {
      id: string;
      status: AdminDisputeSummary['status'];
      resolution?: string;
    }) => createApiClient(token).admin.resolveDispute(id, { status, resolution }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-disputes'] });
      setSelected(null);
    },
  });

  const filtered = disputes?.filter((d) =>
    statusFilter ? d.status === statusFilter : true,
  ) ?? [];

  const columns: Column<AdminDisputeSummary>[] = [
    { header: 'Dispute ID', accessor: (d) => d.id.slice(0, 8) + '…' },
    { header: 'Order', accessor: (d) => d.orderId?.slice(0, 8) + '…' },
    { header: 'Status', accessor: (d) => <Badge value={d.status} /> },
    { header: 'Opened by', accessor: (d) => d.openedBy?.name ?? '—' },
    {
      header: 'Opened',
      accessor: (d) => new Date(d.openedAt).toLocaleDateString(),
    },
    {
      header: 'Actions',
      accessor: (d) => (
        <button
          onClick={() => setSelected(d)}
          className="rounded px-2 py-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          View
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Disputes"
        subtitle="Manage escrow disputes between buyers and sellers"
      />

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="ESCALATED">Escalated</option>
        </select>
      </div>

      {isError ? (
        <ErrorState message="Failed to load disputes." onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          keyExtractor={(d) => d.id}
          loading={isLoading}
          emptyMessage="No disputes match the current filter."
        />
      )}

      {/* Dispute detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-base font-semibold text-gray-900">Dispute Detail</h2>
            <dl className="mb-4 grid grid-cols-2 gap-2 text-sm text-gray-700">
              <dt className="text-gray-500">Order</dt>
              <dd>{selected.orderId}</dd>
              <dt className="text-gray-500">Status</dt>
              <dd><Badge value={selected.status} /></dd>
              <dt className="text-gray-500">Reason</dt>
              <dd>{selected.reason ?? '—'}</dd>
              <dt className="text-gray-500">Opened by</dt>
              <dd>{selected.openedBy?.name ?? '—'}</dd>
            </dl>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSelected(null)}
                className="rounded-md px-3 py-1.5 text-sm border border-gray-300 hover:bg-gray-50"
              >
                Close
              </button>
              {selected.status !== 'UNDER_REVIEW' && (
                <button
                  onClick={() => resolve.mutate({ id: selected.id, status: 'UNDER_REVIEW' })}
                  disabled={resolve.isPending}
                  className="rounded-md px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 hover:bg-yellow-200 disabled:opacity-50"
                >
                  Mark under review
                </button>
              )}
              {selected.status !== 'RESOLVED' && (
                <button
                  onClick={() => {
                    const resolution = window.prompt('Resolution notes:') ?? undefined;
                    resolve.mutate({ id: selected.id, status: 'RESOLVED', resolution });
                  }}
                  disabled={resolve.isPending}
                  className="rounded-md px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
