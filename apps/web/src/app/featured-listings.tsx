'use client';

import Link from 'next/link';
import { useListings } from '../lib/react-query/hooks';

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(priceCents / 100);
}

export function FeaturedListings() {
  const { data, isLoading, isError } = useListings({ page: 1, pageSize: 12, status: 'PUBLISHED' });

  if (isLoading) {
    return (
      <div className="card-forumo">
        <h2 className="text-2xl font-bold mb-4">Discover Forumo Africa</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="aspect-square bg-slate-200 rounded-sm" />
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data || data.data.length === 0) {
    return (
      <div className="card-forumo">
        <h2 className="text-2xl font-bold mb-4">Discover Forumo Africa</h2>
        <div className="text-center py-12 space-y-3">
          <p className="text-slate-500">No listings yet. Be the first to sell!</p>
          <Link href="/listings/new" className="btn-forumo inline-block">
            Create a listing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card-forumo">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Discover Forumo Africa</h2>
        <Link href="/listings" className="text-forumo-link text-sm hover:text-forumo-orange">
          View all listings
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {data.data.slice(0, 12).map((listing) => (
          <Link key={listing.id} href={`/listings/${listing.id}`} className="group space-y-2">
            <div className="relative aspect-square bg-slate-100 rounded-sm overflow-hidden">
              {listing.images && listing.images.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.images[0].url}
                  alt={listing.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <p className="text-sm font-medium truncate group-hover:text-forumo-link">{listing.title}</p>
            {listing.location && (
              <p className="text-xs text-slate-400 truncate">{listing.location}</p>
            )}
            <p className="text-lg font-bold text-slate-900">{formatPrice(listing.priceCents, listing.currency ?? 'USD')}</p>
          </Link>
        ))}
      </div>
      {data.total > 12 && (
        <div className="mt-4 text-center">
          <Link href="/listings" className="text-forumo-link hover:text-forumo-orange text-sm font-medium">
            See all {data.total} listings
          </Link>
        </div>
      )}
    </div>
  );
}
