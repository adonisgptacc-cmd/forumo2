'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import Image from 'next/image';
import Link from 'next/link';
import { Storefront, SafeListing, ListingSearchResponse } from '@forumo/shared';
import { useSellerReviewRollup } from '../../../lib/react-query/hooks';

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(priceCents / 100);
}

function ListingCard({ listing }: { listing: SafeListing }) {
  return (
    <Link
      href={`/listings/${listing.id}` as any}
      className="group block card overflow-hidden hover:border-[color:var(--accent)]/40 transition-colors"
    >
      <div className="relative aspect-square bg-[color:var(--surface-2)]">
        {listing.images && listing.images.length > 0 ? (
          <img
            src={listing.images[0].url}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[color:var(--ink-3)]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <p className="text-sm font-medium text-[color:var(--ink)] truncate group-hover:text-[color:var(--accent)] transition-colors">
          {listing.title}
        </p>
        {listing.location && (
          <p className="text-xs text-[color:var(--ink-3)] truncate">{listing.location}</p>
        )}
        <p className="text-base font-bold text-[color:var(--accent)]">
          {formatPrice(listing.priceCents, listing.currency ?? 'USD')}
        </p>
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
          <div key={i} className="skeleton rounded-xl overflow-hidden">
            <div className="aspect-square" />
            <div className="p-3 space-y-2">
              <div className="h-3 rounded w-3/4" />
              <div className="h-4 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-[color:var(--line)] rounded-xl">
        <p className="text-[color:var(--ink-3)]">No active listings yet.</p>
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
        <p className="text-center text-sm text-[color:var(--ink-3)]">
          Showing 24 of {data.total} listings
        </p>
      )}
    </div>
  );
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  const full = Math.round(rating);
  return (
    <span className="text-amber-500">
      {'★'.repeat(full)}{'☆'.repeat(max - full)}
    </span>
  );
}

function SellerReviewsSection({ sellerId }: { sellerId: string }) {
  const { data: rollup, isLoading: rollupLoading } = useSellerReviewRollup(sellerId);

  if (rollupLoading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-5 rounded w-40" />
        <div className="skeleton h-16 rounded" />
      </div>
    );
  }

  if (!rollup || rollup.publishedCount === 0) {
    return (
      <div className="py-10 text-center border border-dashed border-[color:var(--line)] rounded-xl">
        <p className="text-[color:var(--ink-3)] text-sm">No reviews yet.</p>
      </div>
    );
  }

  const starKey = (s: number): keyof typeof rollup => `star${s}` as keyof typeof rollup;
  const pct = (n: number) => rollup.publishedCount > 0 ? Math.round((n / rollup.publishedCount) * 100) : 0;

  return (
    <div className="card p-6 space-y-5">
      {/* Summary */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-5xl font-bold text-[color:var(--ink)]">{rollup.averageRating.toFixed(1)}</p>
          <StarRating rating={rollup.averageRating} />
          <p className="text-xs text-[color:var(--ink-3)] mt-1">
            {rollup.publishedCount} review{rollup.publishedCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex-1 space-y-1.5 text-sm">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = (rollup as any)[starKey(star)] as number ?? 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="text-[color:var(--ink-3)] w-3">{star}</span>
                <span className="text-amber-500 text-xs">★</span>
                <div className="flex-1 h-2 bg-[color:var(--line)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${pct(count)}%` }}
                  />
                </div>
                <span className="text-[color:var(--ink-3)] text-xs w-8 text-right">{pct(count)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {rollup.pendingCount > 0 && (
        <p className="text-xs text-[color:var(--ink-3)]">
          {rollup.pendingCount} review{rollup.pendingCount !== 1 ? 's' : ''} pending moderation
        </p>
      )}
    </div>
  );
}

function MobileAppBanner({ slug }: { slug: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-[color:var(--surface-2)] border-b border-[color:var(--line)] px-4 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl flex-shrink-0">📱</span>
        <p className="text-xs text-[color:var(--ink-2)] leading-snug">
          Open this shop in the <span className="font-semibold text-[color:var(--ink)]">Forumo app</span> for the best experience
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <a
          href={`forumo://shop/${slug}`}
          className="btn btn-primary btn-sm"
        >
          Open app
        </a>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[color:var(--ink-3)] hover:text-[color:var(--ink)] text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
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
      <div className="min-h-screen bg-[color:var(--bg)]">
        <div className="skeleton h-56 w-full" />
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          <div className="skeleton h-6 rounded w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton rounded-xl overflow-hidden">
                <div className="aspect-square" />
                <div className="p-3 space-y-2">
                  <div className="h-3 rounded w-3/4" />
                  <div className="h-4 rounded w-1/2" />
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
      <div className="min-h-screen bg-[color:var(--bg)] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-[color:var(--ink)]">Storefront not found</p>
          <p className="text-sm text-[color:var(--ink-3)]">This shop may not exist or has been removed.</p>
          <Link href="/listings" className="mt-4 inline-block text-sm text-[color:var(--accent)] hover:underline">
            Browse all listings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <MobileAppBanner slug={slug} />

      {/* Banner */}
      <div className="relative h-56 w-full overflow-hidden bg-[color:var(--surface-2)]">
        {storefront.bannerUrl ? (
          <Image src={storefront.bannerUrl} alt={storefront.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-[color:var(--surface-2)] via-[color:var(--line)] to-[color:var(--surface-2)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--bg)]/70 to-transparent" />
      </div>

      {/* Shop identity row */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end gap-5 -mt-12 relative z-10">
          {/* Logo */}
          <div className="w-24 h-24 flex-shrink-0 rounded-xl border-4 border-[color:var(--bg)] bg-[color:var(--surface-2)] overflow-hidden shadow-[var(--shadow)]">
            {storefront.logoUrl ? (
              <Image src={storefront.logoUrl} alt={storefront.name} width={96} height={96} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-[color:var(--ink-3)]">
                {storefront.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Name & meta */}
          <div className="pb-2 flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[color:var(--ink)] truncate">{storefront.name}</h1>
            <p className="text-sm text-[color:var(--ink-3)]">@{storefront.slug}</p>
          </div>
        </div>

        {/* Description */}
        {storefront.description && (
          <p className="mt-4 text-sm text-[color:var(--ink-2)] max-w-2xl">{storefront.description}</p>
        )}

        {/* Collections */}
        {storefront.collections && storefront.collections.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-[color:var(--ink)] mb-4">Collections</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {storefront.collections.map((col: any) => (
                <div key={col.id} className="card p-5">
                  <h3 className="font-medium text-[color:var(--ink)]">{col.name}</h3>
                  {col.description && (
                    <p className="text-xs text-[color:var(--ink-3)] mt-1">{col.description}</p>
                  )}
                  {col.productIds?.length > 0 && (
                    <p className="text-xs text-[color:var(--ink-3)] mt-2">{col.productIds.length} items</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Listings grid */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">
              {storefront.user ? `All listings by ${storefront.user.name ?? storefront.name}` : 'Listings'}
            </h2>
          </div>
          {storefront.user?.id ? (
            <SellerListings sellerId={storefront.user.id} />
          ) : (
            <div className="py-12 text-center text-[color:var(--ink-3)] text-sm">Unable to load listings.</div>
          )}
        </div>

        {/* Seller Reviews */}
        {storefront.user?.id && (
          <div className="mt-10 pb-12">
            <h2 className="text-lg font-semibold text-[color:var(--ink)] mb-4">Seller Reviews</h2>
            <SellerReviewsSection sellerId={storefront.user.id} />
          </div>
        )}
      </div>
    </div>
  );
}
