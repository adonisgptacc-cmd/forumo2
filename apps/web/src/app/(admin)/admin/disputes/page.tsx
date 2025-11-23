import { DataTable, FilterBar } from '@forumo/design-system';
import { getServerSession } from 'next-auth';

import { createApiClient } from '../../../../lib/api-client';
import { authOptions } from '../../../../lib/auth';
import { resolveDispute } from './actions';

function currency(amount?: number, currencyCode?: string) {
  if (!amount) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode ?? 'USD' }).format(amount / 100);
}

export default async function DisputesPage() {
  const session = await getServerSession(authOptions);
  const api = createApiClient(session?.accessToken);
  const disputes = await api.admin.listDisputes();

  return (
    <div className="space-y-4">
      <FilterBar title="Active disputes">
        <span className="text-slate-400">{disputes.length} escalations in review</span>
      </FilterBar>
      <DataTable
        columns={[
          {
            key: 'orderNumber',
            header: 'Order',
            render: (item) => (
              <div className="space-y-1">
                <p className="font-medium">{item.orderNumber ?? 'Unknown order'}</p>
                <p className="text-xs text-slate-400">Escrow {item.escrowId}</p>
              </div>
            ),
          },
          {
            key: 'reason',
            header: 'Reason',
            render: (item) => (
              <div className="space-y-1 text-sm text-slate-200">
                <p>{item.reason}</p>
                <p className="text-xs text-slate-400">Opened {new Date(item.openedAt).toLocaleString()}</p>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (item) => (
              <div className="space-y-1 text-sm text-slate-200">
                <span className="rounded-full border border-amber-400/60 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                  {item.status}
                </span>
                <p className="text-xs text-slate-400">Messages: {item.messageCount}</p>
              </div>
            ),
          },
          {
            key: 'amountCents',
            header: 'Amount',
            render: (item) => <span className="text-sm text-slate-200">{currency(item.amountCents, item.currency)}</span>,
          },
          {
            key: 'openedBy',
            header: 'Opened by',
            render: (item) => (
              <div className="text-sm text-slate-200">
                {item.openedBy?.name ?? item.openedBy?.email ?? 'Unknown'}
              </div>
            ),
          },
          {
            key: 'actions',
            header: 'Resolution',
            render: (item) => (
              <div className="space-y-2 text-xs text-slate-200">
                <form action={resolveDispute} className="flex flex-col gap-2">
                  <input type="hidden" name="disputeId" value={item.id} />
                  <input type="hidden" name="status" value="UNDER_REVIEW" />
                  <button
                    type="submit"
                    className="rounded-md border border-amber-300/60 bg-amber-300/10 px-3 py-2 text-left text-amber-100 transition hover:border-amber-200"
                  >
                    Move to review
                  </button>
                </form>
                <form action={resolveDispute} className="space-y-2">
                  <input type="hidden" name="disputeId" value={item.id} />
                  <input type="hidden" name="status" value="RESOLVED" />
                  <textarea
                    name="resolution"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                    placeholder="Resolution notes"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-md border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-left text-emerald-50 transition hover:border-emerald-300"
                  >
                    Resolve dispute
                  </button>
                </form>
              </div>
            ),
          },
        ]}
        data={disputes}
        emptyState={<span className="text-sm text-slate-400">No active disputes found.</span>}
      />
    </div>
  );
}
