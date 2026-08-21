"use client";

import Link from "next/link";
import {
  useOffers,
  useAcceptOffer,
  useDeclineOffer,
  useCurrentUser,
} from "../../../../lib/react-query/hooks";
import type { SafeOffer } from "@forumo/shared";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-amber-700 border-amber-200 bg-amber-50",
  ACCEPTED: "text-emerald-700 border-emerald-200 bg-emerald-50",
  DECLINED: "text-red-700 border-red-200 bg-red-50",
  EXPIRED:
    "text-[color:var(--ink-3)] border-[color:var(--line)] bg-[color:var(--surface-2)]",
  CANCELLED:
    "text-[color:var(--ink-3)] border-[color:var(--line)] bg-[color:var(--surface-2)]",
};

export function OffersBoard() {
  const { data, isLoading } = useOffers();
  const { user } = useCurrentUser();
  const accept = useAcceptOffer();
  const decline = useDeclineOffer();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="skeleton h-28 rounded-[14px]" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card card-pad p-10 text-center space-y-3">
        <p className="text-4xl">🤝</p>
        <p className="font-medium text-[color:var(--ink)]">No offers yet</p>
        <p className="text-sm muted max-w-xs mx-auto">
          Browse listings and click &quot;Make an offer&quot; to negotiate a
          price with sellers.
        </p>
        <Link
          href={"/listings" as any}
          className="btn btn-primary btn-sm mt-2 inline-flex"
        >
          Browse listings
        </Link>
      </div>
    );
  }

  const received = data.filter((o) => o.sellerId === user?.id);
  const sent = data.filter((o) => o.buyerId === user?.id);

  return (
    <div className="space-y-8">
      {received.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-[color:var(--ink-3)] uppercase tracking-wider">
            Received offers ({received.length})
          </h3>
          <div className="space-y-3">
            {received.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                role="seller"
                onAccept={() => accept.mutate(offer.id)}
                onDecline={() => decline.mutate(offer.id)}
                actionPending={accept.isPending || decline.isPending}
              />
            ))}
          </div>
        </section>
      )}

      {sent.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-[color:var(--ink-3)] uppercase tracking-wider">
            Sent offers ({sent.length})
          </h3>
          <div className="space-y-3">
            {sent.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                role="buyer"
                actionPending={false}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OfferCard({
  offer,
  role,
  onAccept,
  onDecline,
  actionPending,
}: {
  offer: SafeOffer;
  role: "buyer" | "seller";
  onAccept?: () => void;
  onDecline?: () => void;
  actionPending: boolean;
}) {
  const statusColor =
    STATUS_COLORS[offer.status] ??
    "text-[color:var(--ink-3)] border-[color:var(--line)] bg-[color:var(--surface-2)]";
  const canAct = role === "seller" && offer.status === "PENDING";

  return (
    <article className="card card-pad space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {offer.listing?.title ?? offer.listingId}
          </p>
          <p className="text-xs muted">
            {role === "buyer"
              ? `To: ${offer.seller?.name ?? "Seller"}`
              : `From: ${offer.buyer?.name ?? "Buyer"}`}
          </p>
          <p className="text-xs muted">
            {new Date(offer.createdAt).toLocaleString()}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-0.5 text-xs font-medium ${statusColor}`}
        >
          {offer.status}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">
          {(offer.amountCents / 100).toFixed(2)} {offer.currency}
        </p>
        {offer.expiresAt && offer.status === "PENDING" && (
          <p className="text-xs muted">
            Expires {new Date(offer.expiresAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {offer.message && (
        <p className="rounded-lg bg-[color:var(--surface-2)] px-3 py-2 text-sm subtle italic">
          &ldquo;{offer.message}&rdquo;
        </p>
      )}

      {canAct && (
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            disabled={actionPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {actionPending ? "…" : "Accept"}
          </button>
          <button
            onClick={onDecline}
            disabled={actionPending}
            className="btn btn-ghost btn-sm"
          >
            {actionPending ? "…" : "Decline"}
          </button>
        </div>
      )}

      {offer.status === "ACCEPTED" && role === "buyer" && (
        <p className="text-sm text-[color:var(--escrow)]">
          Offer accepted — check your orders for the new order.
        </p>
      )}
    </article>
  );
}
