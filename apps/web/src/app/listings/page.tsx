import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

interface ListingSummary {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  status: string;
}

async function fetchListings(): Promise<ListingSummary[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/listings`, { cache: 'no-store' });
    if (!res.ok) {
      return [];
    }
    return res.json();
  } catch (error) {
    console.warn('Failed to load listings', error);
    return [];
  }
}

function formatPrice(priceCents: number, currency: string): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
  }).format(priceCents / 100);
}

export default async function ListingsIndex() {
  const listings = await fetchListings();

  return (
    <main className="space-y-6">
      <header className="items-start justify-between gap-4 space-y-2 md:flex md:space-y-0">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Marketplace</p>
          <h1 className="text-3xl font-semibold">Listings</h1>
          <p className="text-slate-300">Fresh inventory flowing through the NestJS API.</p>
        </div>
        <Link
          className="inline-flex items-center justify-center rounded-md border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-400/10"
          href="/listings/new"
        >
          + New listing
        </Link>
      </header>

      {listings.length === 0 ? (
        <div className="grid-card space-y-2 text-slate-300">
          <p>No listings yet. Use the API or the form to create one.</p>
          <Link className="text-sm text-amber-300" href="/listings/new">
            Create the first listing →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {listings.map((listing) => (
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
      )}
    </main>
  );
}
