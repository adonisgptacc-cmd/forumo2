'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCurrentUser, useAuctions } from '../../../../lib/react-query/hooks';
import type { Auction } from '@forumo/shared';

function fmt(cents: number) {
  return new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function timeLeft(endAt: string) {
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  ENDED:     'bg-slate-500/15 text-slate-400 border-slate-500/30',
  CANCELLED: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function AuctionRow({ auction }: { auction: Auction }) {
  const currentPrice = auction.currentBidCents ?? auction.startingBidCents;
  const ended = new Date(auction.endAt).getTime() < Date.now();

  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      {/* Thumb */}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-800">
        {auction.listing?.images?.[0]?.url ? (
          <Image src={auction.listing.images[0].url} alt={auction.listing.title ?? ''} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl text-slate-600">🔨</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium truncate">{auction.listing?.title ?? 'Untitled'}</p>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[auction.status] ?? STATUS_BADGE.ENDED}`}>
            {auction.status}
          </span>
        </div>
        <p className="text-sm text-slate-400">
          Current bid: <span className="font-semibold text-white">{fmt(currentPrice)}</span>
          <span className="ml-3 text-slate-500">·</span>
          <span className="ml-2 text-slate-500">{ended ? 'Ended' : timeLeft(auction.endAt)}</span>
          {(auction as any).bidCount !== undefined && (
            <span className="ml-3 text-slate-500">{(auction as any).bidCount} bid{(auction as any).bidCount !== 1 ? 's' : ''}</span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        {auction.status === 'ACTIVE' && (
          <Link
            href={`/auctions/${auction.id}` as any}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20"
          >
            View live →
          </Link>
        )}
        <Link
          href={`/auctions/${auction.id}` as any}
          className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
        >
          Details
        </Link>
      </div>
    </div>
  );
}

export default function SellerAuctionsPage() {
  const { user } = useCurrentUser();
  const { data, isLoading } = useAuctions({
    sellerId: user?.id,
    pageSize: 50,
    status: undefined, // all statuses
  });

  const auctions = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Auctions</h1>
          <p className="text-sm text-slate-400 mt-1">Manage and monitor your live auctions</p>
        </div>
        <Link
          href={'/app/auctions/new' as any}
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
        >
          + New Auction
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center">
          <p className="text-slate-400 mb-4">You have no auctions yet.</p>
          <Link
            href={'/app/auctions/new' as any}
            className="inline-block rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Create your first auction
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {auctions.map((auction) => (
            <AuctionRow key={auction.id} auction={auction} />
          ))}
        </div>
      )}
    </div>
  );
}
