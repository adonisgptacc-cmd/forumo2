"use client";

import type { SafeListing } from "@forumo/shared";
import Link from "next/link";

const CONDITION_LABEL: Record<string, string> = {
  NEW: "New",
  LIKE_NEW: "Like New",
  GOOD: "Good",
  FAIR: "Fair",
};

const CONDITION_COLOR: Record<string, string> = {
  NEW: "bg-emerald-100 text-emerald-700",
  LIKE_NEW: "bg-blue-100 text-blue-700",
  GOOD: "bg-yellow-100 text-yellow-700",
  FAIR: "bg-orange-100 text-orange-700",
};

type ListingCardProps = {
  listing: SafeListing & { seller?: { name?: string | null } | null };
};

export function ListingCard({ listing }: ListingCardProps) {
  const condition = (listing.metadata as Record<string, unknown> | null)
    ?.condition as string | undefined;
  const sellerName = (listing as any).seller?.name as string | undefined;
  const firstImage = listing.images?.[0];

  return (
    <Link
      href={`/listings/${listing.id}` as any}
      className="card-forumo group flex flex-col hover:shadow-lg transition-shadow overflow-hidden p-0"
    >
      <div className="relative aspect-square bg-slate-100 overflow-hidden">
        {firstImage?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firstImage.url}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12"
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
        {listing.status === "DRAFT" && (
          <span className="absolute top-2 left-2 bg-slate-600 text-white text-xs px-2 py-0.5 rounded">
            Draft
          </span>
        )}
        {condition && (
          <span
            className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded font-medium ${CONDITION_COLOR[condition] ?? "bg-slate-100 text-slate-600"}`}
          >
            {CONDITION_LABEL[condition] ?? condition}
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-sm font-medium line-clamp-2 group-hover:text-forumo-link min-h-[2.5rem]">
          {listing.title}
        </h3>
        {sellerName && (
          <p className="text-xs text-slate-500 mt-1 truncate">{sellerName}</p>
        )}
        {listing.location && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {listing.location}
          </p>
        )}
        <p className="text-base font-bold mt-auto pt-2">
          {formatPrice(listing.priceCents, listing.currency)}
        </p>
      </div>
    </Link>
  );
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    priceCents / 100,
  );
}
