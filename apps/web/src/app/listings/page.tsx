import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
const DEFAULT_PAGE_SIZE = 12;

interface ListingSummary {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  status: string;
}

interface ListingSearchResult {
  data: ListingSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

type ListingsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const emptyResult: ListingSearchResult = {
  data: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  pageCount: 0,
};

function normalizeSearchParams(params: ListingsPageProps['searchParams']): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!params) {
    return normalized;
  }
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        normalized[key] = value[0];
      }
    } else if (value !== undefined) {
      normalized[key] = value;
    }
  }
  return normalized;
}

function buildPageLink(params: Record<string, string>, page: number): string {
  const nextParams = new URLSearchParams(params);
  nextParams.set('page', String(page));
  if (!nextParams.has('pageSize')) {
    nextParams.set('pageSize', String(DEFAULT_PAGE_SIZE));
  }
  return `/listings?${nextParams.toString()}`;
}

async function fetchListings(searchParams: ListingsPageProps['searchParams']): Promise<ListingSearchResult> {
  try {
    const normalized = normalizeSearchParams(searchParams);
    if (!normalized.page) {
      normalized.page = '1';
    }
    if (!normalized.pageSize) {
      normalized.pageSize = String(DEFAULT_PAGE_SIZE);
    }
    const query = new URLSearchParams(normalized);
    const res = await fetch(`${API_BASE_URL}/listings/search?${query.toString()}`, { cache: 'no-store' });
    if (!res.ok) {
      return emptyResult;
    }
    return (await res.json()) as ListingSearchResult;
  } catch (error) {
    console.warn('Failed to load listing search results', error);
    return emptyResult;
  }
}

function formatPrice(priceCents: number, currency: string): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
  }).format(priceCents / 100);
}

export default async function ListingsIndex({ searchParams }: ListingsPageProps) {
  const normalizedParams = normalizeSearchParams(searchParams);
  const listingsResult = await fetchListings(searchParams);
  const showingFrom = listingsResult.data.length
    ? (listingsResult.page - 1) * listingsResult.pageSize + 1
    : 0;
  const showingTo = listingsResult.data.length ? showingFrom + listingsResult.data.length - 1 : 0;
  const prevLink = listingsResult.page > 1 ? buildPageLink(normalizedParams, listingsResult.page - 1) : null;
  const nextLink =
    listingsResult.pageCount > 0 && listingsResult.page < listingsResult.pageCount
      ? buildPageLink(normalizedParams, listingsResult.page + 1)
      : null;

  return (
    <main className="space-y-6">
      <header className="items-start justify-between gap-4 space-y-2 md:flex md:space-y-0">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Marketplace</p>
          <h1 className="text-3xl font-semibold">Listings</h1>
          <p className="text-slate-300">Search and filter inventory from the NestJS API.</p>
        </div>
        <Link
          className="inline-flex items-center justify-center rounded-md border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-400/10"
          href="/listings/new"
        >
          + New listing
        </Link>
      </header>

      <form className="grid gap-4 rounded-xl border border-slate-700/80 bg-slate-900/60 p-4 md:grid-cols-[2fr,1fr,1fr]" action="/listings">
        <label className="grid gap-1 text-sm font-medium text-slate-300">
          Keyword
          <input
            className="rounded-md border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
            type="text"
            name="keyword"
            defaultValue={normalizedParams.keyword ?? ''}
            placeholder="e.g. kente, pottery"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-300">
          Status
          <select
            className="rounded-md border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
            name="status"
            defaultValue={normalizedParams.status ?? ''}
          >
            <option value="">Any</option>
            <option value="PUBLISHED">Published</option>
            <option value="PAUSED">Paused</option>
            <option value="DRAFT">Draft</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-300">
          Seller ID
          <input
            className="rounded-md border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
            type="text"
            name="sellerId"
            defaultValue={normalizedParams.sellerId ?? ''}
            placeholder="UUID"
          />
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

      {listingsResult.data.length === 0 ? (
        <div className="grid-card space-y-2 text-slate-300">
          <p>No listings matched your search.</p>
          <p className="text-sm text-slate-500">
            Try adjusting the keyword or filters, or
            <Link className="text-amber-300" href="/listings/new">
              {' '}create a new listing →
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-slate-400">
            <p>
              Showing {showingFrom} – {showingTo} of {listingsResult.total} listings
            </p>
            <div className="flex items-center gap-3">
              {prevLink ? (
                <Link className="text-amber-300" href={prevLink}>
                  ← Previous
                </Link>
              ) : (
                <span className="text-slate-600">← Previous</span>
              )}
              {nextLink ? (
                <Link className="text-amber-300" href={nextLink}>
                  Next →
                </Link>
              ) : (
                <span className="text-slate-600">Next →</span>
              )}
            </div>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {listingsResult.data.map((listing) => (
              <li key={listing.id} className="grid-card space-y-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{listing.status}</p>
                  <h2 className="text-xl font-semibold">
                    <Link href={`/listings/${listing.id}`}>{listing.title}</Link>
                  </h2>
                  <p className="text-sm text-slate-400">{listing.description}</p>
                </div>
                <p className="text-lg font-semibold">{formatPrice(listing.priceCents, listing.currency)}</p>
                <Link className="text-sm text-amber-300" href={`/listings/${listing.id}`}>
                  View details →
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
