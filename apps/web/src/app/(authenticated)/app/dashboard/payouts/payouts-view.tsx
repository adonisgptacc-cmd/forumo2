"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  usePayoutBalance,
  usePayouts,
  usePayoutOnboard,
  useRequestPayout,
  useCurrentUser,
} from "../../../../../lib/react-query/hooks";
import { createApiClient } from "../../../../../lib/api-client";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── StripeConnectBanner ─────────────────────────────────────────────────────

function StripeConnectBanner() {
  const searchParams = useSearchParams();
  const stripeReturn = searchParams?.get("stripe");
  const { accessToken } = useCurrentUser();
  const { data, isLoading, refetch } = usePayoutOnboard();

  const initOnboard = useMutation<{ url: string }, Error, void>({
    mutationFn: async () => {
      const api = createApiClient(accessToken);
      return api.post("/payments/stripe/connect/onboard", {}, { auth: true });
    },
    onSuccess: (result) => {
      if (result?.url) {
        window.location.href = result.url;
      }
    },
  });

  // When Stripe redirects back with ?stripe=success, refresh the status
  if (stripeReturn === "success") {
    refetch();
  }

  if (isLoading) {
    return <div className="skeleton h-12 rounded-xl" />;
  }

  if (stripeReturn === "success" && (!data || data.status !== "connected")) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
        <span className="text-sm text-blue-700">
          Verifying your bank connection…
        </span>
      </div>
    );
  }

  if (!data) return null;

  if (data.status === "connected") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span className="text-[color:var(--escrow)] text-lg">✓</span>
        <span className="text-sm text-emerald-700 font-medium">
          Bank account connected
        </span>
      </div>
    );
  }

  if (data.status === "pending") {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-700">
            Account under review
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Stripe is reviewing your account. You&apos;ll be notified once
            approved — this usually takes 1–2 business days.
          </p>
        </div>
        {data.onboardingUrl && (
          <a
            href={data.onboardingUrl}
            className="shrink-0 rounded-lg border border-blue-200 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 transition-colors text-center"
          >
            Continue setup →
          </a>
        )}
      </div>
    );
  }

  // incomplete — show connect CTA
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-800">
          Connect your bank account to receive payments
        </p>
        <p className="text-xs text-[color:var(--accent)]/80 mt-1">
          Link a bank account via Stripe to withdraw your available balance.
        </p>
      </div>
      <button
        onClick={() => initOnboard.mutate()}
        disabled={initOnboard.isPending}
        className="shrink-0 rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--accent-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {initOnboard.isPending ? "Connecting…" : "Connect your bank account"}
      </button>
      {initOnboard.isError && (
        <p className="text-xs text-red-600 sm:col-span-2">
          {(initOnboard.error as Error).message}
        </p>
      )}
    </div>
  );
}

// ─── NewSellerHoldNotice ──────────────────────────────────────────────────────

function NewSellerHoldNotice({ completedCount }: { completedCount: number }) {
  if (completedCount >= 3) return null;
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 space-y-1">
      <p className="text-sm font-semibold text-blue-700">
        14-day hold on new payouts
      </p>
      <p className="text-xs text-[color:var(--ink-3)]">
        As a new seller, your first payouts are held for 14 days to protect
        buyers. This hold is lifted after you complete 3 payouts — you have{" "}
        {completedCount} so far.
      </p>
    </div>
  );
}

// ─── RequestPayoutModal ───────────────────────────────────────────────────────

function RequestPayoutModal({
  availableCents,
  minimumCents,
  currency,
  onClose,
}: {
  availableCents: number;
  minimumCents: number;
  currency: string;
  onClose: () => void;
}) {
  const [amountStr, setAmountStr] = useState("");
  const { mutate, isPending, isSuccess, error } = useRequestPayout();

  const amountCents = Math.round(parseFloat(amountStr || "0") * 100);
  const tooLow = amountCents > 0 && amountCents < minimumCents;
  const tooHigh = amountCents > availableCents;
  const invalid = !amountStr || tooLow || tooHigh || amountCents <= 0;

  function submit() {
    if (invalid) return;
    mutate(amountCents);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-6 space-y-5 fade-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Request payout</h2>
          <button
            onClick={onClose}
            className="text-[color:var(--ink-3)] hover:text-[color:var(--ink-2)] text-xl leading-none"
          >
            ×
          </button>
        </div>

        {isSuccess ? (
          <div className="space-y-4">
            <p className="text-sm text-[color:var(--escrow)]">
              Payout request submitted! Funds will arrive within 2–3 business
              days.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-[color:var(--ink)] text-white px-4 py-2 text-sm font-medium hover:bg-[oklch(0.30_0.012_50)] transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-xs text-[color:var(--ink-3)] uppercase tracking-wider">
                Amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)]">
                  $
                </span>
                <input
                  type="number"
                  min={minimumCents / 100}
                  max={availableCents / 100}
                  step="0.01"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder={(availableCents / 100).toFixed(2)}
                  className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] pl-7 pr-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
                />
              </div>
              <p className="text-xs text-[color:var(--ink-3)]">
                Available: {fmt(availableCents, currency)} · Minimum:{" "}
                {fmt(minimumCents, currency)}
              </p>
              {tooLow && (
                <p className="text-xs text-red-600">
                  Amount is below the minimum payout.
                </p>
              )}
              {tooHigh && (
                <p className="text-xs text-red-600">
                  Amount exceeds your available balance.
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600">{(error as Error).message}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-[color:var(--line-2)] px-4 py-2 text-sm text-[color:var(--ink-2)] hover:bg-[color:var(--surface-2)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={invalid || isPending}
                className="flex-1 rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--accent-2)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPending ? "Requesting…" : "Request payout"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── PayoutBalanceCard ────────────────────────────────────────────────────────

function PayoutBalanceCard() {
  const { data, isLoading, isError, refetch } = usePayoutBalance();
  const [showModal, setShowModal] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-xl card p-6 space-y-4">
        <div className="h-3 w-32 skeleton" />
        <div className="h-10 w-48 skeleton" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-12 skeleton" />
          <div className="h-12 skeleton" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl card p-6 space-y-2">
        <p className="text-sm text-red-600">Failed to load balance.</p>
        <button
          onClick={() => refetch()}
          className="text-xs text-[color:var(--accent)] hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const canRequest = data.availableCents >= data.minimumPayoutCents;

  return (
    <>
      <div className="rounded-xl card p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-[color:var(--ink-3)]">
              Available Balance
            </p>
            <p className="text-4xl font-bold text-[color:var(--escrow)]">
              {fmt(data.availableCents, data.currency)}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            disabled={!canRequest}
            className="self-start rounded-lg bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--accent-2)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              !canRequest
                ? `Minimum payout is ${fmt(data.minimumPayoutCents, data.currency)}`
                : undefined
            }
          >
            Request Payout
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[color:var(--line)]">
          <div className="space-y-0.5">
            <p className="text-xs text-[color:var(--ink-3)]">
              Total paid to date
            </p>
            <p className="text-base font-semibold text-[color:var(--ink-2)]">
              {fmt(data.totalPaidCents, data.currency)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-[color:var(--ink-3)]">
              Next scheduled payout
            </p>
            <p className="text-base font-semibold text-[color:var(--ink-2)]">
              {data.nextPayoutDate ? fmtDate(data.nextPayoutDate) : "—"}
            </p>
          </div>
        </div>
      </div>

      {showModal && (
        <RequestPayoutModal
          availableCents={data.availableCents}
          minimumCents={data.minimumPayoutCents}
          currency={data.currency}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const statusStyles: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  processing: "bg-blue-50 text-blue-700 border border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  failed: "bg-red-50 text-red-700 border border-red-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status] ?? statusStyles.pending}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={copy}
      className="ml-1 text-[color:var(--ink-3)] hover:text-[color:var(--ink-2)] transition-colors text-xs"
      title="Copy transfer ID"
    >
      {copied ? "✓" : "⎘"}
    </button>
  );
}

// ─── PayoutHistoryTable ───────────────────────────────────────────────────────

function PayoutHistoryTable() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = usePayouts(page);

  if (isLoading) {
    return (
      <div className="rounded-xl card p-5 space-y-3">
        <div className="h-4 w-32 skeleton" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 skeleton" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl card p-5 space-y-2">
        <p className="text-sm text-red-600">Failed to load payout history.</p>
        <button
          onClick={() => refetch()}
          className="text-xs text-[color:var(--accent)] hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const payouts = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="rounded-xl card overflow-hidden">
      <div className="px-5 py-4 border-b border-[color:var(--line)]">
        <h3 className="font-semibold">Payout history</h3>
      </div>

      {payouts.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-[color:var(--ink-3)]">
          No payouts yet — complete bank onboarding to get started.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--line)] text-xs text-[color:var(--ink-3)] uppercase tracking-wider">
                  <th className="px-5 py-3 text-left font-medium">Date</th>
                  <th className="px-5 py-3 text-left font-medium">Amount</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">
                    Transfer ID
                  </th>
                  <th className="px-5 py-3 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {payouts.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-[color:var(--surface-2)] transition-colors"
                  >
                    <td className="px-5 py-3 text-[color:var(--ink-2)] whitespace-nowrap">
                      {fmtDate(p.createdAt)}
                    </td>
                    <td className="px-5 py-3 font-medium text-[color:var(--ink-2)] whitespace-nowrap">
                      {fmt(p.amountCents, p.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3 text-[color:var(--ink-3)] font-mono text-xs whitespace-nowrap">
                      {p.transferId ? (
                        <>
                          {p.transferId.slice(0, 16)}…
                          <CopyButton text={p.transferId} />
                        </>
                      ) : (
                        <span className="text-[color:var(--ink-3)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--ink-3)] text-xs max-w-[200px] truncate">
                      {p.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-[color:var(--line)]">
            {payouts.map((p) => (
              <div key={p.id} className="px-4 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[color:var(--ink-2)]">
                    {fmt(p.amountCents, p.currency)}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
                <p className="text-xs text-[color:var(--ink-3)]">
                  {fmtDate(p.createdAt)}
                </p>
                {p.transferId && (
                  <p className="text-xs text-[color:var(--ink-3)] font-mono">
                    {p.transferId.slice(0, 20)}…
                    <CopyButton text={p.transferId} />
                  </p>
                )}
                {p.notes && (
                  <p className="text-xs text-[color:var(--ink-3)]">{p.notes}</p>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[color:var(--line)]">
              <p className="text-xs text-[color:var(--ink-3)]">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-[color:var(--line-2)] px-3 py-1.5 text-xs text-[color:var(--ink-2)] hover:bg-[color:var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-[color:var(--line-2)] px-3 py-1.5 text-xs text-[color:var(--ink-2)] hover:bg-[color:var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export function PayoutsView() {
  const { data: balance } = usePayoutBalance();

  return (
    <div className="space-y-5">
      <StripeConnectBanner />
      {balance && (
        <NewSellerHoldNotice completedCount={balance.completedPayoutCount} />
      )}
      <PayoutBalanceCard />
      <PayoutHistoryTable />
    </div>
  );
}
