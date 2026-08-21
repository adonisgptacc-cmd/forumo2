import { DataTable, FilterBar } from "@forumo/design-system";
import { getServerSession } from "next-auth";

import { createApiClient } from "../../../../lib/api-client";
import { authOptions } from "../../../../lib/auth";
import { resolveDispute } from "./actions";

function currency(amount?: number, currencyCode?: string) {
  if (!amount) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode ?? "USD",
  }).format(amount / 100);
}

export default async function DisputesPage() {
  const session = await getServerSession(authOptions);
  const api = createApiClient(session?.accessToken);
  const disputes = await api.admin.listDisputes();

  return (
    <div className="space-y-4">
      <FilterBar title="Active disputes">
        <span className="text-[color:var(--ink-3)]">
          {disputes.length} escalations in review
        </span>
      </FilterBar>
      <DataTable
        columns={[
          {
            key: "orderNumber",
            header: "Order",
            render: (item) => (
              <div className="space-y-1">
                <p className="font-medium">
                  {item.orderNumber ?? "Unknown order"}
                </p>
                <p className="text-xs text-[color:var(--ink-3)]">
                  Escrow {item.escrowId}
                </p>
              </div>
            ),
          },
          {
            key: "reason",
            header: "Reason",
            render: (item) => (
              <div className="space-y-1 text-sm text-[color:var(--ink-2)]">
                <p>{item.reason}</p>
                <p className="text-xs text-[color:var(--ink-3)]">
                  Opened {new Date(item.openedAt).toLocaleString()}
                </p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <div className="space-y-1 text-sm text-[color:var(--ink-2)]">
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
                  {item.status}
                </span>
                <p className="text-xs text-[color:var(--ink-3)]">
                  Messages: {item.messageCount}
                </p>
              </div>
            ),
          },
          {
            key: "amountCents",
            header: "Amount",
            render: (item) => (
              <span className="text-sm text-[color:var(--ink-2)]">
                {currency(item.amountCents, item.currency)}
              </span>
            ),
          },
          {
            key: "openedBy",
            header: "Opened by",
            render: (item) => (
              <div className="text-sm text-[color:var(--ink-2)]">
                {item.openedBy?.name ?? item.openedBy?.email ?? "Unknown"}
              </div>
            ),
          },
          {
            key: "actions",
            header: "Resolution",
            render: (item) => (
              <div className="space-y-2 text-xs text-[color:var(--ink-2)]">
                <form action={resolveDispute} className="flex flex-col gap-2">
                  <input type="hidden" name="disputeId" value={item.id} />
                  <input type="hidden" name="status" value="UNDER_REVIEW" />
                  <button
                    type="submit"
                    className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-left text-amber-700 transition hover:bg-amber-100"
                  >
                    Move to review
                  </button>
                </form>
                <form action={resolveDispute} className="space-y-2">
                  <input type="hidden" name="disputeId" value={item.id} />
                  <input type="hidden" name="status" value="RESOLVED" />
                  <textarea
                    name="resolution"
                    className="w-full rounded-md w-full rounded-md border border-[color:var(--line-2)] bg-[color:var(--surface)] px-3 py-2 text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
                    placeholder="Resolution notes"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Resolve dispute
                  </button>
                </form>
              </div>
            ),
          },
        ]}
        data={disputes}
        emptyState={
          <span className="text-sm text-[color:var(--ink-3)]">
            No active disputes found.
          </span>
        }
      />
    </div>
  );
}
