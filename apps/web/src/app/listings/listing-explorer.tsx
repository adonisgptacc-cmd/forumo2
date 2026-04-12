'use client';

import type { ListingSearchParams } from '@forumo/shared';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useListings, useCategories } from '../../lib/react-query/hooks';

const DEFAULTS: ListingSearchParams = {
  keyword: undefined,
  sellerId: undefined,
  status: undefined,
  page: 1,
  pageSize: 24,
  minPriceCents: undefined,
  maxPriceCents: undefined,
  tags: [],
  sort: undefined,
  categories: [],
};

export function ListingExplorer({ initialParams }: { initialParams: Partial<ListingSearchParams> }) {
  const [filters, setFilters] = useState<Partial<ListingSearchParams>>({ ...DEFAULTS, ...initialParams });
  const [filtersOpen, setFiltersOpen] = useState(false);
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

    const categoriesValue = formData.getAll('categories') as string[];
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
      sort: (formData.get('sort') as ListingSearchParams['sort']) || undefined,
      categories: categoriesValue.filter(Boolean),
      page: 1,
      pageSize: filters.pageSize ?? DEFAULTS.pageSize,
    };

    setFilters(next);
  }

  const goToPage = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Header */}
      <div className="card-forumo flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <p className="text-sm text-slate-500 mt-1">
            {filters.keyword ? `Results for "${filters.keyword}"` : 'Browse all listings on Forumo'}
          </p>
        </div>
        <Link className="btn-forumo text-sm whitespace-nowrap" href="/listings/new">
          + New listing
        </Link>
      </div>

      {/* Search & Filters */}
      <form
        className="card-forumo space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSearch(new FormData(event.currentTarget));
        }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
            <input
              className="input-forumo"
              type="text"
              name="keyword"
              defaultValue={filters.keyword ?? ''}
              placeholder="Search titles, descriptions, or tags"
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-forumo px-6" type="submit">Search</button>
            <button
              className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
              type="button"
              onClick={() => setFilters(DEFAULTS)}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1"
            >
              <span>Filters</span>
              {activeFilterCount(filters) > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-forumo-orange text-white text-[10px] font-bold">
                  {activeFilterCount(filters)}
                </span>
              )}
              <span className="text-xs">{filtersOpen ? '▲' : '▼'}</span>
            </button>
          </div>
        </div>

        {filtersOpen && <FilterPanel filters={filters} />}

        {/* Active filter chips */}
        <ActiveFilterChips filters={filters} onRemove={(key) => setFilters((prev) => ({ ...prev, [key]: undefined, page: 1 }))} />
      </form>

      {/* Results */}
      {/* Sort */}
      <div className="flex items-center justify-end gap-2">
        <label className="text-sm text-slate-600 font-medium">Sort by:</label>
        <select
          className="input-forumo py-1 text-sm"
          value={filters.sort ?? ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, sort: (e.target.value as ListingSearchParams['sort']) || undefined, page: 1 }))}
        >
          <option value="">Relevance</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="date_new">Newest First</option>
          <option value="date_old">Oldest First</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card-forumo animate-pulse space-y-3">
              <div className="aspect-square bg-slate-200 rounded" />
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="card-forumo text-center py-12">
          <p className="text-red-600 font-medium">Could not load listings</p>
          <p className="text-sm text-slate-500 mt-1">{(error as Error | undefined)?.message ?? 'Please try again.'}</p>
        </div>
      ) : data && data.data.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <p>Showing {showingFrom}–{showingTo} of {data.total} results</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-forumo-link disabled:text-slate-300 hover:underline"
                onClick={() => goToPage(Math.max(1, (filters.page ?? 1) - 1))}
                disabled={!data || data.page <= 1}
              >
                Previous
              </button>
              <span className="text-slate-400">Page {data.page} of {data.pageCount}</span>
              <button
                type="button"
                className="text-forumo-link disabled:text-slate-300 hover:underline"
                onClick={() => goToPage((filters.page ?? 1) + 1)}
                disabled={!data || data.page >= data.pageCount}
              >
                Next
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" aria-busy={isFetching}>
            {data.data.map((listing) => (
              <Link key={listing.id} href={`/listings/${listing.id}`} className="card-forumo group hover:shadow-lg transition-shadow">
                <div className="relative aspect-square bg-slate-100 rounded overflow-hidden mb-3">
                  {listing.images && listing.images.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={listing.images[0].url}
                      alt={listing.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {listing.status === 'DRAFT' && (
                    <span className="absolute top-2 left-2 bg-slate-600 text-white text-xs px-2 py-0.5 rounded">Draft</span>
                  )}
                </div>
                <h3 className="text-sm font-medium line-clamp-2 group-hover:text-forumo-link min-h-[2.5rem]">
                  {listing.title}
                </h3>
                {listing.location && (
                  <p className="text-xs text-slate-400 mt-1">{listing.location}</p>
                )}
                <p className="text-lg font-bold mt-1">{formatPrice(listing.priceCents, listing.currency ?? 'USD')}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="card-forumo text-center py-16 space-y-3">
          <p className="text-slate-500 font-medium">No listings matched your search</p>
          <p className="text-sm text-slate-400">Try different keywords or filters</p>
          <Link className="btn-forumo inline-block mt-2" href="/listings/new">
            Create a listing
          </Link>
        </div>
      )}
    </div>
  );
}

function FilterPanel({ filters }: { filters: Partial<ListingSearchParams> }) {
  const { data: categoriesData } = useCategories();
  const categories = categoriesData ?? [];

  return (
    <div className="border-t border-slate-100 pt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Status</span>
          <select className="input-forumo mt-1" name="status" defaultValue={filters.status ?? ''}>
            <option value="">Any status</option>
            <option value="PUBLISHED">Published</option>
            <option value="PAUSED">Paused</option>
            <option value="DRAFT">Draft</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Min price (USD)</span>
          <input
            className="input-forumo mt-1"
            type="number"
            min={0}
            name="minPriceCents"
            step="0.01"
            defaultValue={filters.minPriceCents ? filters.minPriceCents / 100 : ''}
            placeholder="0.00"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Max price (USD)</span>
          <input
            className="input-forumo mt-1"
            type="number"
            min={0}
            name="maxPriceCents"
            step="0.01"
            defaultValue={filters.maxPriceCents ? filters.maxPriceCents / 100 : ''}
            placeholder="100.00"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Tags (comma separated)</span>
          <input
            className="input-forumo mt-1"
            type="text"
            name="tags"
            defaultValue={(filters.tags ?? []).join(', ')}
            placeholder="e.g. handmade, cloth"
          />
        </label>
      </div>

      {categories.length > 0 && (
        <div>
          <span className="text-sm font-medium text-slate-700">Categories</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {categories.map((cat) => (
              <label key={cat.id} className="flex items-center gap-1.5 cursor-pointer group">
                <input
                  type="checkbox"
                  name="categories"
                  value={cat.name}
                  defaultChecked={(filters.categories ?? []).includes(cat.name)}
                  className="rounded border-slate-300 text-forumo-orange focus:ring-forumo-orange"
                />
                <span className="text-sm text-slate-600 group-hover:text-slate-900">{cat.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function activeFilterCount(filters: Partial<ListingSearchParams>) {
  let count = 0;
  if (filters.status) count++;
  if (filters.minPriceCents) count++;
  if (filters.maxPriceCents) count++;
  if (filters.tags && filters.tags.length > 0) count++;
  if (filters.categories && filters.categories.length > 0) count++;
  return count;
}

function ActiveFilterChips({
  filters,
  onRemove,
}: {
  filters: Partial<ListingSearchParams>;
  onRemove: (key: keyof ListingSearchParams) => void;
}) {
  const chips: { label: string; key: keyof ListingSearchParams }[] = [];
  if (filters.status) chips.push({ label: `Status: ${filters.status}`, key: 'status' });
  if (filters.minPriceCents) chips.push({ label: `Min: $${(filters.minPriceCents / 100).toFixed(0)}`, key: 'minPriceCents' });
  if (filters.maxPriceCents) chips.push({ label: `Max: $${(filters.maxPriceCents / 100).toFixed(0)}`, key: 'maxPriceCents' });
  if (filters.tags && filters.tags.length > 0) chips.push({ label: `Tags: ${filters.tags.join(', ')}`, key: 'tags' });
  if (filters.categories && filters.categories.length > 0)
    chips.push({ label: `Categories: ${filters.categories.join(', ')}`, key: 'categories' });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 text-xs bg-forumo-orange/10 text-forumo-orange border border-forumo-orange/30 rounded-full px-3 py-1"
        >
          {chip.label}
          <button
            type="button"
            onClick={() => onRemove(chip.key)}
            className="ml-1 text-forumo-orange/70 hover:text-forumo-orange font-bold"
            aria-label={`Remove ${chip.label} filter`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(priceCents / 100);
}
