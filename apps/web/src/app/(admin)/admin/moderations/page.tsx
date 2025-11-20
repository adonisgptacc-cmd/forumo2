import { DataTable, FilterBar } from '@forumo/design-system';
import { getServerSession } from 'next-auth';

import { createApiClient } from '../../../../lib/api-client';
import { authOptions } from '../../../../lib/auth';

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = {
    PENDING: 'border-amber-400 bg-amber-400/10 text-amber-100',
    APPROVED: 'border-emerald-400 bg-emerald-400/10 text-emerald-100',
    REJECTED: 'border-rose-400 bg-rose-400/10 text-rose-100',
    FLAGGED: 'border-orange-400 bg-orange-400/10 text-orange-100',
  };
  const className = palette[status] ?? 'border-slate-700 text-slate-200';
  return <span className={`rounded-full border px-3 py-1 text-xs ${className}`}>{status}</span>;
}

export default async function ModerationQueuePage() {
  const session = await getServerSession(authOptions);
  const api = createApiClient(session?.accessToken);
  const listings = await api.admin.listListingsForReview();

  return (
    <div className="space-y-4">
      <FilterBar title="Listings awaiting moderator decisions">
        <span className="text-slate-400">{listings.length} items in the queue</span>
      </FilterBar>
      <DataTable
        columns={[
          {
            key: 'title',
            header: 'Listing',
            render: (item) => (
              <div className="space-y-1">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-slate-400">Seller: {item.sellerId}</p>
              </div>
            ),
          },
          {
            key: 'moderationStatus',
            header: 'Moderation',
            render: (item) => (
              <div className="space-y-1">
                <StatusPill status={item.moderationStatus} />
                {item.moderationNotes ? <p className="text-xs text-slate-400">{item.moderationNotes}</p> : null}
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Publish status',
            render: (item) => <StatusPill status={item.status} />,
          },
          {
            key: 'createdAt',
            header: 'Created',
            render: (item) => <span className="text-sm text-slate-300">{new Date(item.createdAt).toLocaleString()}</span>,
          },
        ]}
        data={listings}
        emptyState={<span className="text-sm text-slate-400">No listings require moderation.</span>}
      />
    </div>
  );
}
