"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuctions } from "../../lib/react-query/hooks";
import type { Auction } from "@forumo/shared";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Live" },
  { value: "ENDED", label: "Ended" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function timeLeft(endAt: string) {
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function AuctionCard({ auction }: { auction: Auction }) {
  const ended = new Date(auction.endAt).getTime() < Date.now();
  const currentPrice = auction.currentBidCents ?? auction.startingBidCents;

  return (
    <Link
      href={`/auctions/${auction.id}` as any}
      className="card-forumo hover:shadow-lg transition-shadow group flex flex-col"
    >
      <div className="relative aspect-square bg-slate-100 rounded overflow-hidden mb-3">
        {auction.listing?.images?.[0]?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={auction.listing.images[0].url}
            alt={auction.listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        <div
          className={`absolute top-2 right-2 text-white text-xs font-bold px-2 py-1 rounded ${ended ? "bg-slate-500" : "bg-red-600"}`}
        >
          {timeLeft(auction.endAt)}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <h3 className="font-medium text-sm truncate group-hover:text-forumo-link">
          {auction.listing?.title ?? "Untitled Auction"}
        </h3>
        <div className="mt-auto pt-2 space-y-1">
          <p className="text-lg font-bold text-slate-900">
            {formatPrice(currentPrice)}
          </p>
          <p className="text-xs text-slate-500">
            {auction.bidCount ?? 0} bid
            {(auction.bidCount ?? 0) !== 1 ? "s" : ""}
            {auction.buyNowCents && (
              <span className="ml-2 text-forumo-link">
                Buy Now: {formatPrice(auction.buyNowCents)}
              </span>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}

const SORT_OPTIONS = [
  { value: "endingSoon", label: "Ending soon" },
  { value: "newest", label: "Newest first" },
  { value: "priceAsc", label: "Price: low to high" },
  { value: "priceDesc", label: "Price: high to low" },
];

const PAGE_SIZE = 12;

export default function AuctionsPage() {
  const [status, setStatus] = useState<string>("ACTIVE");
  const [sort, setSort] = useState<string>("endingSoon");
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useAuctions({
    status,
    page,
    pageSize: PAGE_SIZE,
    sort,
    keyword: keyword || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    setPage(1);
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setKeyword(keywordInput.trim());
    setPage(1);
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="card-forumo">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Auctions</h1>
            <p className="text-sm text-slate-500 mt-1">
              Bid on unique items with anti-sniping protection
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {data?.total ?? 0} auction{(data?.total ?? 0) !== 1 ? "s" : ""}
            </span>
            <Link
              href={"/app/auctions/new" as any}
              className="btn btn-primary btn-sm"
            >
              + Create auction
            </Link>
          </div>
        </div>
      </div>

      {/* Search + Sort row */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="Search auctions…"
            className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium border border-slate-300 hover:border-amber-400"
          >
            Search
          </button>
          {keyword && (
            <button
              type="button"
              onClick={() => {
                setKeyword("");
                setKeywordInput("");
                setPage(1);
              }}
              className="text-sm text-slate-500 hover:text-red-500"
            >
              ✕ Clear
            </button>
          )}
        </form>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleStatusChange(opt.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              status === opt.value
                ? "bg-amber-500 border-amber-500 text-black"
                : "border-slate-300 text-slate-600 hover:border-amber-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="card-forumo animate-pulse space-y-3">
              <div className="aspect-square bg-slate-200 rounded" />
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="card-forumo text-center py-12">
          <p className="text-red-600 font-medium">Failed to load auctions</p>
          <p className="text-sm text-slate-500 mt-1">
            The auction service may not be available
          </p>
        </div>
      ) : data && data.data.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.data.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      ) : (
        <div className="card-forumo text-center py-16 space-y-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 mx-auto text-[color:var(--ink-3)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-[color:var(--ink-2)] font-medium">
            No {status.toLowerCase()} auctions
          </p>
          <p className="text-sm text-[color:var(--ink-3)]">
            Check back soon or create your own auction from a listing
          </p>
          <Link
            href={"/app/auctions/new" as any}
            className="btn-forumo inline-block mt-2"
          >
            Create a listing
          </Link>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
