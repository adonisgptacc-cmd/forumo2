import { DataTable, FilterBar } from '@forumo/design-system';
import { getServerSession } from 'next-auth';

import { createApiClient } from '../../../../lib/api-client';
import { authOptions } from '../../../../lib/auth';
import { reviewKycSubmission } from './actions';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = {
    PENDING: 'border-amber-400 bg-amber-400/10 text-amber-100',
    APPROVED: 'border-emerald-400 bg-emerald-400/10 text-emerald-100',
    REJECTED: 'border-rose-400 bg-rose-400/10 text-rose-100',
  };
  const className = palette[status] ?? 'border-slate-700 text-slate-200';
  return <span className={`rounded-full border px-3 py-1 text-xs ${className}`}>{status}</span>;
}

export default async function KycQueuePage() {
  const session = await getServerSession(authOptions);
  const api = createApiClient(session?.accessToken);
  const submissions = await api.admin.listKycSubmissions();

  return (
    <div className="space-y-4">
      <FilterBar title="Verification submissions">
        <span className="text-slate-400">{submissions.length} profiles awaiting review</span>
      </FilterBar>
      <DataTable
        columns={[
          {
            key: 'user',
            header: 'User',
            render: (item) => (
              <div className="space-y-1">
                <p className="font-medium">{item.user?.name ?? 'Unknown user'}</p>
                <p className="text-xs text-slate-400">{item.user?.email}</p>
              </div>
            ),
          },
          {
            key: 'documents',
            header: 'Documents',
            render: (item) => (
              <div className="space-y-1 text-xs text-slate-300">
                {item.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2">
                    <span className="rounded-full border border-slate-700 px-2 py-0.5">{doc.type}</span>
                    <StatusPill status={doc.status} />
                  </div>
                ))}
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (item) => (
              <div className="space-y-1">
                <StatusPill status={item.status} />
                <p className="text-xs text-slate-400">Submitted {formatDate(item.submittedAt)}</p>
              </div>
            ),
          },
          {
            key: 'reviewer',
            header: 'Reviewer',
            render: (item) => (
              <div className="text-sm text-slate-300">
                {item.reviewer ? item.reviewer.name ?? item.reviewer.email : 'Unassigned'}
              </div>
            ),
          },
          {
            key: 'actions',
            header: 'Decision',
            render: (item) => (
              <div className="space-y-2 text-xs text-slate-200">
                <form action={reviewKycSubmission} className="flex flex-col gap-2">
                  <input type="hidden" name="submissionId" value={item.id} />
                  <input type="hidden" name="decision" value="APPROVED" />
                  <button
                    type="submit"
                    className="rounded-md border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-left text-emerald-50 transition hover:border-emerald-300"
                  >
                    Approve verification
                  </button>
                </form>
                <form action={reviewKycSubmission} className="space-y-2">
                  <input type="hidden" name="submissionId" value={item.id} />
                  <input type="hidden" name="decision" value="REJECTED" />
                  <input
                    name="reason"
                    placeholder="Reason for rejection"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-md border border-rose-400/60 bg-rose-500/10 px-3 py-2 text-left text-rose-100 transition hover:border-rose-300"
                  >
                    Reject submission
                  </button>
                </form>
              </div>
            ),
          },
        ]}
        data={submissions}
        emptyState={<span className="text-sm text-slate-400">No pending KYC submissions.</span>}
      />
    </div>
  );
}
