'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useWishlist, useRemoveSavedListing } from '../../../../lib/react-query/hooks';

export function WishlistView() {
  const { data, isLoading } = useWishlist();
  const remove = useRemoveSavedListing();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-48 rounded-xl bg-slate-800" />)}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-10 text-center space-y-3">
        <p className="text-2xl">♡</p>
        <p className="text-slate-300">Your wishlist is empty.</p>
        <p className="text-sm text-slate-500">
          Browse listings and click the heart to save items for later.
        </p>
        <Link href={"/listings" as any} className="mt-2 inline-block text-sm text-amber-400 hover:underline">
          Browse listings →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {data.map((saved) => {
        const listing = saved.listing;
        if (!listing) return null;
        const thumb = listing.images?.[0]?.url;

        return (
          <article key={saved.id} className="group relative rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
            <Link href={`/listings/${listing.id}` as any}>
              <div className="relative h-40 bg-slate-800">
                {thumb ? (
                  <Image src={thumb} alt={listing.title} fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-600 text-4xl">🏷️</div>
                )}
              </div>
            </Link>

            <div className="p-3 space-y-1">
              <Link href={`/listings/${listing.id}` as any} className="block">
                <p className="text-sm font-medium line-clamp-2 hover:text-amber-400">{listing.title}</p>
              </Link>
              <p className="text-sm font-semibold text-amber-400">
                {new Intl.NumberFormat('en', {
                  style: 'currency',
                  currency: listing.currency ?? 'USD',
                }).format(listing.priceCents / 100)}
              </p>
              <p className="text-xs text-slate-500">{listing.status}</p>
            </div>

            <button
              onClick={() => remove.mutate(listing.id)}
              disabled={remove.isPending}
              title="Remove from wishlist"
              className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-red-400 hover:bg-black/80 hover:text-red-300 transition-colors disabled:opacity-50"
            >
              ♥
            </button>
          </article>
        );
      })}
    </div>
  );
}
