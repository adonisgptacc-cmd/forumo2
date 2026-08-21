"use client";

import Link from "next/link";
import Image from "next/image";
import { useCurrentUser, useAuctions } from "../../../../lib/react-query/hooks";
import type { Auction } from "@forumo/shared";

function fmt(cents: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function timeLeft(endAt: string) {
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ENDED:
    "bg-[color:var(--surface-2)] text-[color:var(--ink-3)] border-[color:var(--line)]",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

function AuctionRow({ auction }: { auction: Auction }) {
  const currentPrice = auction.currentBidCents ?? auction.startingBidCents;
  const ended = new Date(auction.endAt).getTime() < Date.now();

  return (
    <div className="card flex items-center gap-4 p-4">
      {/* Thumb */}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[color:var(--surface-2)]">
        {auction.listing?.images?.[0]?.url ? (
          <Image
            src={auction.listing.images[0].url}
            alt={auction.listing.title ?? ""}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl text-[color:var(--ink-3)]">
            🔨
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium truncate">
            {auction.listing?.title ?? "Untitled"}
          </p>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[auction.status] ?? STATUS_BADGE.ENDED}`}
          >
            {auction.status}
          </span>
        </div>
        <p className="text-sm text-[color:var(--ink-3)]">
          Current bid:{" "}
          <span className="font-semibold text-[color:var(--ink)]">
            {fmt(currentPrice)}
          </span>
          <span className="ml-3 text-[color:var(--ink-3)]">·</span>
          <span className="ml-2 text-[color:var(--ink-3)]">
            {ended ? "Ended" : timeLeft(auction.endAt)}
          </span>
          {(auction as any).bidCount !== undefined && (
            <span className="ml-3 text-[color:var(--ink-3)]">
              {(auction as any).bidCount} bid
              {(auction as any).bidCount !== 1 ? "s" : ""}
            </span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        {auction.status === "ACTIVE" && (
          <Link
            href={`/auctions/${auction.id}` as any}
            className="rounded-lg border border-[color:var(--accent)]/40 bg-[color:var(--accent-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-2)] hover:brightness-[0.97]"
          >
            View live →
          </Link>
        )}
        <Link
          href={`/auctions/${auction.id}` as any}
          className="rounded-lg px-3 py-1.5 text-xs text-[color:var(--ink-3)] hover:bg-[color:var(--surface-2)]"
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
          <p className="text-sm text-[color:var(--ink-3)] mt-1">
            Manage and monitor your live auctions
          </p>
        </div>
        <Link href={"/app/auctions/new" as any} className="btn btn-primary">
          + New Auction
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--line-2)] p-12 text-center">
          <p className="text-[color:var(--ink-3)] mb-4">
            You have no auctions yet.
          </p>
          <Link
            href={"/app/auctions/new" as any}
            className="btn btn-primary inline-flex"
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
