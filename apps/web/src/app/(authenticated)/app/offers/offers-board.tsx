'use client';

import Link from 'next/link';
import { useOffers, useAcceptOffer, useDeclineOffer, useCurrentUser } from '../../../../lib/react-query/hooks';
import type { SafeOffer } from '@forumo/shared';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-400 border-yellow-700',
  ACCEPTED: 'text-emerald-400 border-emerald-700',
  DECLINED: 'text-red-400 border-red-700',
  EXPIRED: 'text-slate-400 border-slate-700',
  CANCELLED: 'text-slate-400 border-slate-700',
};

export function OffersBoard() {
  const { data, isLoading } = useOffers();
  const { user } = useCurrentUser();
  const accept = useAcceptOffer();
  const decline = useDeclineOffer();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-slate-800" />)}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-10 text-center space-y-3">
        <p className="text-4xl">🤝</p>
        <p className="font-medium text-slate-200">No offers yet</p>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          Browse listings and click &quot;Make an offer&quot; to negotiate a price with sellers.
        </p>
        <Link href={"/listings" as any} className="mt-2 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 transition-colors">
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
          <h3 className="mb-3 text-sm font-semibold text-slate-400 uppercase tracking-wider">
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
          <h3 className="mb-3 text-sm font-semibold text-slate-400 uppercase tracking-wider">
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
  role: 'buyer' | 'seller';
  onAccept?: () => void;
  onDecline?: () => void;
  actionPending: boolean;
}) {
  const statusColor = STATUS_COLORS[offer.status] ?? 'text-slate-400 border-slate-700';
  const canAct = role === 'seller' && offer.status === 'PENDING';

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {offer.listing?.title ?? offer.listingId}
          </p>
          <p className="text-xs text-slate-500">
            {role === 'buyer' ? `To: ${offer.seller?.name ?? 'Seller'}` : `From: ${offer.buyer?.name ?? 'Buyer'}`}
          </p>
          <p className="text-xs text-slate-500">
            {new Date(offer.createdAt).toLocaleString()}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-0.5 text-xs font-medium ${statusColor}`}>
          {offer.status}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">
          {(offer.amountCents / 100).toFixed(2)} {offer.currency}
        </p>
        {offer.expiresAt && offer.status === 'PENDING' && (
          <p className="text-xs text-slate-500">
            Expires {new Date(offer.expiresAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {offer.message && (
        <p className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm text-slate-300 italic">
          &ldquo;{offer.message}&rdquo;
        </p>
      )}

      {canAct && (
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            disabled={actionPending}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {actionPending ? '…' : 'Accept'}
          </button>
          <button
            onClick={onDecline}
            disabled={actionPending}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50"
          >
            {actionPending ? '…' : 'Decline'}
          </button>
        </div>
      )}

      {offer.status === 'ACCEPTED' && role === 'buyer' && (
        <p className="text-sm text-emerald-400">
          Offer accepted — check your orders for the new order.
        </p>
      )}
    </article>
  );
}
