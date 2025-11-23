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
  minPriceCents: undefined,
  maxPriceCents: undefined,
  tags: [],
};

export function ListingExplorer({ initialParams }: { initialParams: Partial<ListingSearchParams> }) {
  const [filters, setFilters] = useState<Partial<ListingSearchParams>>({ ...DEFAULTS, ...initialParams });
  const { data, isLoading, isError, error, isFetching } = useListings(filters);

  const { showingFrom, showingTo } = useMemo(() => {
    if (!data || data.data.length === 0) {
      return { showingFrom: 0, showingTo: 0 };
    }
    const start = (data.page - 1) * data.pageSize + 1;
    return { showingFrom: start, showingTo: start + data.data.length - 1 };
  }, [data]);

  function handleSearch(formData: FormData) {
    const tagsValue = (formData.get('tags') as string) || '';
    const minPrice = Number(formData.get('minPriceCents'));
    const maxPrice = Number(formData.get('maxPriceCents'));

    const next: Partial<ListingSearchParams> = {
      keyword: (formData.get('keyword') as string) || undefined,
      sellerId: (formData.get('sellerId') as string) || undefined,
      status: (formData.get('status') as ListingSearchParams['status']) || undefined,
      minPriceCents: Number.isFinite(minPrice) && minPrice > 0 ? Math.round(minPrice * 100) : undefined,
      maxPriceCents: Number.isFinite(maxPrice) && maxPrice > 0 ? Math.round(maxPrice * 100) : undefined,
      tags: tagsValue
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
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
        className="space-y-4 rounded-xl border border-slate-700/80 bg-slate-900/60 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSearch(new FormData(event.currentTarget));
        }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <label className="grid gap-1 text-sm font-medium text-slate-300">
              Search the marketplace
              <input
                className="input"
                type="text"
                name="keyword"
                defaultValue={filters.keyword ?? ''}
                placeholder="Search titles, descriptions, or tags"
              />
            </label>
          </div>
          <div className="flex gap-3">
            <button
              className="h-10 rounded-md border border-amber-400 px-6 text-sm font-semibold uppercase tracking-[0.25em] text-amber-100 hover:bg-amber-400/10"
              type="submit"
            >
              Search
            </button>
            <button
              className="h-10 rounded-md border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              type="button"
              onClick={() => setFilters(DEFAULTS)}
            >
              Clear
            </button>
          </div>
        </div>

        <FilterPanel filters={filters} />
      </form>

      {isLoading ? (
        <div className="grid-card text-slate-400" role="status" aria-live="polite">
          Loading listings…
        </div>
      ) : isError ? (
        <div className="grid-card border-red-500/40 text-red-200" role="alert">
          <p className="font-semibold">We could not load listings.</p>
          <p className="text-sm opacity-80">{(error as Error | undefined)?.message ?? 'Please retry your search.'}</p>
        </div>
      ) : data && data.data.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-400" aria-live="polite">
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
          <ul className="grid gap-4 md:grid-cols-2" aria-busy={isFetching} aria-live="polite">
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
        <div className="grid-card space-y-2 text-slate-300" role="status" aria-live="polite">
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

function FilterPanel({ filters }: { filters: Partial<ListingSearchParams> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      <label className="grid gap-1 text-sm font-medium text-slate-300">
        Min price (USD)
        <input
          className="input"
          type="number"
          min={0}
          name="minPriceCents"
          step="0.01"
          defaultValue={filters.minPriceCents ? filters.minPriceCents / 100 : ''}
          placeholder="0.00"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-300">
        Max price (USD)
        <input
          className="input"
          type="number"
          min={0}
          name="maxPriceCents"
          step="0.01"
          defaultValue={filters.maxPriceCents ? filters.maxPriceCents / 100 : ''}
          placeholder="100.00"
        />
      </label>
      <label className="md:col-span-2 lg:col-span-4 grid gap-1 text-sm font-medium text-slate-300">
        Tags (comma separated)
        <input
          className="input"
          type="text"
          name="tags"
          defaultValue={(filters.tags ?? []).join(', ')}
          placeholder="e.g. handmade, basket, cloth"
        />
        <span className="text-xs font-normal text-slate-500">
          We match tags using full-text search alongside title and description.
        </span>
      </label>
    </div>
  );
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(priceCents / 100);
}
