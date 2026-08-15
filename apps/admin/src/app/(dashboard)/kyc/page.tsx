"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { createApiClient } from "../../../lib/api-client";
import { DataTable, Column } from "../../../components/data-table";
import { Badge } from "../../../components/badge";
import { PageHeader } from "../../../components/page-header";
import { ErrorState } from "../../../components/error-state";
import type { AdminKycSubmission } from "@forumo/shared";

export default function KycPage() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [selected, setSelected] = useState<AdminKycSubmission | null>(null);

  const {
    data: submissions,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-kyc"],
    queryFn: () => createApiClient(token).admin.listKycSubmissions(),
    enabled: !!token,
  });

  const review = useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: "APPROVED" | "REJECTED";
      notes?: string;
    }) =>
      createApiClient(token).admin.reviewKycSubmission(id, {
        status,
        rejectionReason: notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
      setSelected(null);
    },
  });

  const filtered =
    submissions?.filter((s) =>
      statusFilter ? s.status === statusFilter : true,
    ) ?? [];

  const columns: Column<AdminKycSubmission>[] = [
    { header: "User", accessor: (s) => s.user?.name ?? s.userId },
    { header: "Email", accessor: (s) => s.user?.email ?? "—" },
    { header: "Status", accessor: (s) => <Badge value={s.status} /> },
    {
      header: "Submitted",
      accessor: (s) => new Date(s.submittedAt).toLocaleDateString(),
    },
    {
      header: "Documents",
      accessor: (s) => `${s.documents?.length ?? 0} doc(s)`,
    },
    {
      header: "Actions",
      accessor: (s) => (
        <button
          onClick={() => setSelected(s)}
          className="rounded px-2 py-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          Review
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="KYC Queue"
        subtitle="Review identity verification submissions"
      />

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {isError ? (
        <ErrorState
          message="Failed to load KYC submissions."
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          keyExtractor={(s) => s.id}
          loading={isLoading}
          emptyMessage="No KYC submissions match the current filter."
        />
      )}

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-base font-semibold text-gray-900">
              Review KYC Submission
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              {selected.user?.name} · {selected.user?.email}
            </p>

            <div className="mb-4 space-y-2">
              {(selected.documents ?? []).map((doc: any) => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-blue-600 hover:bg-gray-50"
                >
                  {doc.documentType ?? "Document"} ↗
                </a>
              ))}
              {(selected.documents ?? []).length === 0 && (
                <p className="text-sm text-gray-400">No documents uploaded.</p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSelected(null)}
                className="rounded-md px-3 py-1.5 text-sm border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const notes =
                    window.prompt("Rejection reason (optional):") ?? undefined;
                  review.mutate({ id: selected.id, status: "REJECTED", notes });
                }}
                disabled={review.isPending}
                className="rounded-md px-3 py-1.5 text-sm bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() =>
                  review.mutate({ id: selected.id, status: "APPROVED" })
                }
                disabled={review.isPending}
                className="rounded-md px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
