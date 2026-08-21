import { DataTable, FilterBar } from "@forumo/design-system";
import { getServerSession } from "next-auth";

import { createApiClient } from "../../../../lib/api-client";
import { authOptions } from "../../../../lib/auth";
import { reviewKycSubmission } from "./actions";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = {
    PENDING: "border-amber-200 bg-amber-50 text-amber-700",
    APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REJECTED: "border-red-200 bg-red-50 text-red-700",
  };
  const className =
    palette[status] ?? "border-[color:var(--line)] text-[color:var(--ink-2)]";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${className}`}>
      {status}
    </span>
  );
}

export default async function KycQueuePage() {
  const session = await getServerSession(authOptions);
  const api = createApiClient(session?.accessToken);
  const submissions = await api.admin.listKycSubmissions();

  return (
    <div className="space-y-4">
      <FilterBar title="Verification submissions">
        <span className="text-[color:var(--ink-3)]">
          {submissions.length} profiles awaiting review
        </span>
      </FilterBar>
      <DataTable
        columns={[
          {
            key: "user",
            header: "User",
            render: (item) => (
              <div className="space-y-1">
                <p className="font-medium">
                  {item.user?.name ?? "Unknown user"}
                </p>
                <p className="text-xs text-[color:var(--ink-3)]">
                  {item.user?.email}
                </p>
              </div>
            ),
          },
          {
            key: "documents",
            header: "Documents",
            render: (item) => (
              <div className="space-y-1 text-xs text-[color:var(--ink-2)]">
                {item.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2">
                    <span className="rounded-full border border-[color:var(--line)] px-2 py-0.5">
                      {doc.type}
                    </span>
                    <StatusPill status={doc.status} />
                  </div>
                ))}
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <div className="space-y-1">
                <StatusPill status={item.status} />
                <p className="text-xs text-[color:var(--ink-3)]">
                  Submitted {formatDate(item.submittedAt)}
                </p>
              </div>
            ),
          },
          {
            key: "reviewer",
            header: "Reviewer",
            render: (item) => (
              <div className="text-sm text-[color:var(--ink-2)]">
                {item.reviewer
                  ? (item.reviewer.name ?? item.reviewer.email)
                  : "Unassigned"}
              </div>
            ),
          },
          {
            key: "actions",
            header: "Decision",
            render: (item) => (
              <div className="space-y-2 text-xs text-[color:var(--ink-2)]">
                <form
                  action={reviewKycSubmission}
                  className="flex flex-col gap-2"
                >
                  <input type="hidden" name="submissionId" value={item.id} />
                  <input type="hidden" name="decision" value="APPROVED" />
                  <button
                    type="submit"
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-emerald-700 transition hover:bg-emerald-100"
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
                    className="w-full w-full rounded-md border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] focus:border-[color:var(--accent)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-red-700 transition hover:bg-red-100"
                  >
                    Reject submission
                  </button>
                </form>
              </div>
            ),
          },
        ]}
        data={submissions}
        emptyState={
          <span className="text-sm text-[color:var(--ink-3)]">
            No pending KYC submissions.
          </span>
        }
      />
    </div>
  );
}
