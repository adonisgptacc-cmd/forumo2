'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { apiClient } from '../../../lib/api-client';
import Image from 'next/image';
import Link from 'next/link';
import { Storefront, SafeListing, ListingSearchResponse } from '@forumo/shared';
import { useSellerReviewRollup, useListingReviews } from '../../../lib/react-query/hooks';

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(priceCents / 100);
}

function ListingCard({ listing }: { listing: SafeListing }) {
  return (
    <Link href={`/listings/${listing.id}` as any} className="group block rounded-xl border border-slate-800 bg-slate-900 overflow-hidden hover:border-amber-500/40 transition-colors">
      <div className="relative aspect-square bg-slate-800">
        {listing.images && listing.images.length > 0 ? (
          <img
            src={listing.images[0].url}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <p className="text-sm font-medium text-white truncate group-hover:text-amber-400 transition-colors">{listing.title}</p>
        {listing.location && <p className="text-xs text-slate-500 truncate">{listing.location}</p>}
        <p className="text-base font-bold text-amber-400">{formatPrice(listing.priceCents, listing.currency ?? 'USD')}</p>
      </div>
    </Link>
  );
}

function SellerListings({ sellerId }: { sellerId: string }) {
  const { data, isLoading } = useQuery<ListingSearchResponse>({
    queryKey: ['listings', { sellerId, status: 'PUBLISHED' }],
    queryFn: () => apiClient.listings.search({ sellerId, status: 'PUBLISHED', pageSize: 24 }),
    enabled: !!sellerId,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden animate-pulse">
            <div className="aspect-square bg-slate-800" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-slate-800 rounded w-3/4" />
              <div className="h-4 bg-slate-800 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl">
        <p className="text-slate-500">No active listings yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {data.data.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
      {data.total > 24 && (
        <p className="text-center text-sm text-slate-500">
          Showing 24 of {data.total} listings
        </p>
      )}
    </div>
  );
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  const full = Math.round(rating);
  return (
    <span className="text-amber-400">
      {'★'.repeat(full)}{'☆'.repeat(max - full)}
    </span>
  );
}

function SellerReviewsSection({ sellerId }: { sellerId: string }) {
  const { data: rollup, isLoading: rollupLoading } = useSellerReviewRollup(sellerId);
  // Pull reviews via the first listing query is not ideal; use the rollup + a dedicated listing id
  // We show rollup stats + link to individual listing reviews instead
  if (rollupLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-5 bg-slate-800 rounded w-40" />
        <div className="h-16 bg-slate-800 rounded" />
      </div>
    );
  }

  if (!rollup || rollup.publishedCount === 0) {
    return (
      <div className="py-10 text-center border border-dashed border-slate-800 rounded-xl">
        <p className="text-slate-500 text-sm">No reviews yet.</p>
      </div>
    );
  }

  const pct = (n: number) => rollup.reviewCount > 0 ? Math.round((n / rollup.reviewCount) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
      {/* Summary */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-5xl font-bold text-white">{rollup.averageRating.toFixed(1)}</p>
          <StarRating rating={rollup.averageRating} />
          <p className="text-xs text-slate-400 mt-1">{rollup.publishedCount} review{rollup.publishedCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1 space-y-1.5 text-sm">
          {[5, 4, 3, 2, 1].map((star) => (
            <div key={star} className="flex items-center gap-2">
              <span className="text-slate-400 w-3">{star}</span>
              <span className="text-amber-400 text-xs">★</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full"
                  style={{ width: `${pct(rollup.reviewCount)}%` }}
                />
              </div>
              <span className="text-slate-500 text-xs w-8 text-right">{pct(rollup.reviewCount)}%</span>
            </div>
          ))}
        </div>
      </div>

      {rollup.pendingCount > 0 && (
        <p className="text-xs text-slate-500">{rollup.pendingCount} review{rollup.pendingCount !== 1 ? 's' : ''} pending moderation</p>
      )}
    </div>
  );
}

export function StorefrontView() {
  const params = useParams();
  const slug = params.slug as string;

  const { data: storefront, isLoading, error } = useQuery<Storefront>({
    queryKey: ['storefront', slug],
    queryFn: () => apiClient.storefronts.get(slug),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="h-56 bg-slate-800 animate-pulse" />
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          <div className="h-6 bg-slate-800 rounded w-48 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden animate-pulse">
                <div className="aspect-square bg-slate-800" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-slate-800 rounded w-3/4" />
                  <div className="h-4 bg-slate-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !storefront) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-white">Storefront not found</p>
          <p className="text-sm text-slate-400">This shop may not exist or has been removed.</p>
          <Link href="/listings" className="mt-4 inline-block text-sm text-amber-400 hover:underline">
            Browse all listings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Banner */}
      <div className="relative h-56 w-full overflow-hidden bg-slate-900">
        {storefront.bannerUrl ? (
          <Image src={storefront.bannerUrl} alt={storefront.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
      </div>

      {/* Shop identity row */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end gap-5 -mt-12 relative z-10">
          {/* Logo */}
          <div className="w-24 h-24 flex-shrink-0 rounded-xl border-4 border-slate-950 bg-slate-800 overflow-hidden">
            {storefront.logoUrl ? (
              <Image src={storefront.logoUrl} alt={storefront.name} width={96} height={96} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-slate-500">
                {storefront.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Name & meta */}
          <div className="pb-2 flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{storefront.name}</h1>
            <p className="text-sm text-slate-400">@{storefront.slug}</p>
          </div>
        </div>

        {/* Description */}
        {storefront.description && (
          <p className="mt-4 text-sm text-slate-400 max-w-2xl">{storefront.description}</p>
        )}

        {/* Collections */}
        {storefront.collections && storefront.collections.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-white mb-4">Collections</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {storefront.collections.map((col: any) => (
                <div key={col.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                  <h3 className="font-medium text-white">{col.name}</h3>
                  {col.description && <p className="text-xs text-slate-400 mt-1">{col.description}</p>}
                  {col.productIds?.length > 0 && (
                    <p className="text-xs text-slate-500 mt-2">{col.productIds.length} items</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Listings grid */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">
              {storefront.user ? `All listings by ${storefront.user.name ?? storefront.name}` : 'Listings'}
            </h2>
          </div>
          {storefront.user?.id ? (
            <SellerListings sellerId={storefront.user.id} />
          ) : (
            <div className="py-12 text-center text-slate-500 text-sm">Unable to load listings.</div>
          )}
        </div>

        {/* Seller Reviews */}
        {storefront.user?.id && (
          <div className="mt-10 pb-12">
            <h2 className="text-lg font-semibold text-white mb-4">Seller Reviews</h2>
            <SellerReviewsSection sellerId={storefront.user.id} />
          </div>
        )}
      </div>
    </div>
  );
}
