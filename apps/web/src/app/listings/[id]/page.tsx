import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

interface ListingDetail {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  status: string;
  location?: string | null;
  variants?: { id: string; label: string; priceCents: number; currency: string; inventoryCount: number }[];
  images?: { id: string; url: string }[];
}

async function fetchListing(id: string): Promise<ListingDetail | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/listings/${id}`, { cache: 'no-store' });
    if (!res.ok) {
      return null;
    }
    return res.json();
  } catch (error) {
    console.warn('Failed to load listing', error);
    return null;
  }
}

function formatPrice(priceCents: number, currency: string): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
  }).format(priceCents / 100);
}

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const listing = await fetchListing(params.id);

  if (!listing) {
    return (
      <main className="space-y-4">
        <p className="text-slate-400">Listing not found or API unavailable.</p>
        <Link className="text-amber-300" href="/listings">
          ← Back to listings
        </Link>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-amber-300" href="/listings">
          ← Back to listings
        </Link>
        <Link
          className="text-sm text-amber-200 underline decoration-dotted underline-offset-4"
          href={`/listings/${listing.id}/edit`}
        >
          Edit listing
        </Link>
      </div>
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{listing.status}</p>
        <h1 className="text-4xl font-semibold">{listing.title}</h1>
        <p className="text-slate-300">{listing.description}</p>
        <p className="text-xl font-semibold">{formatPrice(listing.priceCents, listing.currency)}</p>
        {listing.location ? <p className="text-sm text-slate-400">Ships from {listing.location}</p> : null}
      </section>

      {listing.variants && listing.variants.length > 0 ? (
        <section className="grid-card space-y-3">
          <h2 className="text-2xl">Variants</h2>
          <ul className="space-y-2">
            {listing.variants.map((variant) => (
              <li key={variant.id} className="flex items-center justify-between text-sm">
                <span>{variant.label}</span>
                <span className="font-semibold">{formatPrice(variant.priceCents, variant.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {listing.images && listing.images.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-2xl">Images</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listing.images.map((image) => (
              <div key={image.id} className="rounded-xl border border-slate-800 p-2">
                {image.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt={listing.title} className="h-48 w-full rounded-lg object-cover" />
                ) : (
                  <p className="text-xs text-slate-500">Image ready once uploaded.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
