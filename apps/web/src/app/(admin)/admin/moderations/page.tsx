import { DataTable, FilterBar } from '@forumo/design-system';
import { getServerSession } from 'next-auth';

import { createApiClient } from '../../../../lib/api-client';
import { authOptions } from '../../../../lib/auth';
import { reviewListing } from './actions';

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = {
    PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
    APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    REJECTED: 'border-red-200 bg-red-50 text-red-700',
    FLAGGED: 'border-orange-200 bg-orange-50 text-orange-700',
  };
  const className = palette[status] ?? 'border-[color:var(--line)] text-[color:var(--ink-2)]';
  return <span className={`rounded-full border px-3 py-1 text-xs ${className}`}>{status}</span>;
}

export default async function ModerationQueuePage() {
  const session = await getServerSession(authOptions);
  const api = createApiClient(session?.accessToken);
  const listings = await api.admin.listListingsForReview();

  return (
    <div className="space-y-4">
      <FilterBar title="Listings awaiting moderator decisions">
        <span className="text-[color:var(--ink-3)]">{listings.length} items in the queue</span>
      </FilterBar>
      <DataTable
        columns={[
          {
            key: 'title',
            header: 'Listing',
            render: (item) => (
              <div className="space-y-1">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-[color:var(--ink-3)]">Seller: {item.sellerId}</p>
              </div>
            ),
          },
          {
            key: 'moderationStatus',
            header: 'Moderation',
            render: (item) => (
              <div className="space-y-1">
                <StatusPill status={item.moderationStatus} />
                {item.moderationNotes ? <p className="text-xs text-[color:var(--ink-3)]">{item.moderationNotes}</p> : null}
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
            render: (item) => <span className="text-sm text-[color:var(--ink-2)]">{new Date(item.createdAt).toLocaleString()}</span>,
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (item) => (
              <div className="space-y-2 text-xs text-[color:var(--ink-2)]">
                <form action={reviewListing} className="flex flex-col gap-2">
                  <input type="hidden" name="listingId" value={item.id} />
                  <input type="hidden" name="decision" value="APPROVED" />
                  <button
                    type="submit"
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Approve listing
                  </button>
                </form>
                <form action={reviewListing} className="space-y-2">
                  <input type="hidden" name="listingId" value={item.id} />
                  <input type="hidden" name="decision" value="REJECTED" />
                  <input
                    name="notes"
                    placeholder="Moderation notes"
                    className="w-full rounded-md border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] focus:border-[color:var(--accent)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-red-700 transition hover:bg-red-100"
                  >
                    Reject listing
                  </button>
                </form>
              </div>
            ),
          },
        ]}
        data={listings}
        emptyState={<span className="text-sm text-[color:var(--ink-3)]">No listings require moderation.</span>}
      />
    </div>
  );
}
