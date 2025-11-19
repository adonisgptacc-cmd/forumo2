'use client';

import type { ListingSearchParams } from '@forumo/shared';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useListings } from '../../lib/react-query/hooks';

const DEFAULTS: ListingSearchParams = {
  keyword: undefined,
  sellerId: undefined,
  status: undefined,
  page: 1,
  pageSize: 12,
};

export function ListingExplorer({ initialParams }: { initialParams: Partial<ListingSearchParams> }) {
  const [filters, setFilters] = useState<Partial<ListingSearchParams>>({ ...DEFAULTS, ...initialParams });
  const { data, isLoading } = useListings(filters);

  const { showingFrom, showingTo } = useMemo(() => {
    if (!data || data.data.length === 0) {
      return { showingFrom: 0, showingTo: 0 };
    }
    const start = (data.page - 1) * data.pageSize + 1;
    return { showingFrom: start, showingTo: start + data.data.length - 1 };
  }, [data]);

  function handleSearch(formData: FormData) {
    const next: Partial<ListingSearchParams> = {
      keyword: (formData.get('keyword') as string) || undefined,
      sellerId: (formData.get('sellerId') as string) || undefined,
      status: (formData.get('status') as ListingSearchParams['status']) || undefined,
      page: 1,
      pageSize: filters.pageSize ?? DEFAULTS.pageSize,
    };
    setFilters(next);
  }

  const goToPage = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  return (
    <div className="space-y-6">
      <header className="items-start justify-between gap-4 space-y-2 md:flex md:space-y-0">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Marketplace</p>
          <h1 className="text-3xl font-semibold">Listings</h1>
          <p className="text-slate-300">Query the NestJS listings API through the shared client.</p>
        </div>
        <Link
          className="inline-flex items-center justify-center rounded-md border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-400/10"
          href="/listings/new"
        >
          + New listing
        </Link>
      </header>

      <form
        className="grid gap-4 rounded-xl border border-slate-700/80 bg-slate-900/60 p-4 md:grid-cols-[2fr,1fr,1fr]"
        onSubmit={(event) => {
          event.preventDefault();
          handleSearch(new FormData(event.currentTarget));
        }}
      >
        <label className="grid gap-1 text-sm font-medium text-slate-300">
          Keyword
          <input className="input" type="text" name="keyword" defaultValue={filters.keyword ?? ''} placeholder="e.g. kente" />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-300">
          Status
          <select className="input" name="status" defaultValue={filters.status ?? ''}>
            <option value="">Any</option>
            <option value="PUBLISHED">Published</option>
            <option value="PAUSED">Paused</option>
            <option value="DRAFT">Draft</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-300">
          Seller ID
          <input className="input" type="text" name="sellerId" defaultValue={filters.sellerId ?? ''} placeholder="UUID" />
        </label>
        <div className="md:col-span-3 flex items-center justify-between pt-2 text-sm text-slate-400">
          <span>Use filters to refine results. Leave blank to search everything.</span>
          <button
            className="rounded-md border border-amber-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-100 hover:bg-amber-400/10"
            type="submit"
          >
            Apply
          </button>
        </div>
      </form>

      {isLoading ? (
        <div className="grid-card text-slate-400">Loading listings…</div>
      ) : data && data.data.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <p>
              Showing {showingFrom} – {showingTo} of {data.total} listings
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-amber-300 disabled:text-slate-600"
                onClick={() => goToPage(Math.max(1, (filters.page ?? 1) - 1))}
                disabled={!data || data.page <= 1}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="text-amber-300 disabled:text-slate-600"
                onClick={() => goToPage((filters.page ?? 1) + 1)}
                disabled={!data || data.page >= data.pageCount}
              >
                Next →
              </button>
            </div>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {data.data.map((listing) => (
              <li key={listing.id} className="grid-card space-y-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{listing.status}</p>
                  <h2 className="text-xl font-semibold">
                    <Link href={`/listings/${listing.id}`}>{listing.title}</Link>
                  </h2>
                  <p className="text-sm text-slate-400">{listing.description}</p>
                </div>
                <p className="text-lg font-semibold">{formatPrice(listing.priceCents, listing.currency ?? 'USD')}</p>
                <Link className="text-sm text-amber-300" href={`/listings/${listing.id}`}>
                  View details →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="grid-card space-y-2 text-slate-300">
          <p>No listings matched your search.</p>
          <p className="text-sm text-slate-500">
            Try adjusting the keyword or filters, or
            <Link className="text-amber-300" href="/listings/new">
              {' '}create a new listing →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(priceCents / 100);
}
