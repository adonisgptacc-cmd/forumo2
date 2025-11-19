'use client';

import Link from 'next/link';

import { useListing } from '../../../lib/react-query/hooks';

export function ListingDetail({ id }: { id: string }) {
  const { data, isLoading } = useListing(id);

  if (isLoading) {
    return <p className="text-slate-400">Loading listing…</p>;
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <p className="text-slate-400">Listing not found or API unavailable.</p>
        <Link className="text-amber-300" href="/listings">
          ← Back to listings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-amber-300" href="/listings">
          ← Back to listings
        </Link>
        <Link className="text-sm text-amber-200 underline decoration-dotted underline-offset-4" href={`/listings/${data.id}/edit`}>
          Edit listing
        </Link>
      </div>
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{data.status}</p>
        <h1 className="text-4xl font-semibold">{data.title}</h1>
        <p className="text-slate-300">{data.description}</p>
        <p className="text-xl font-semibold">{formatPrice(data.priceCents, data.currency ?? 'USD')}</p>
        {data.location ? <p className="text-sm text-slate-400">Ships from {data.location}</p> : null}
      </section>

      {data.variants && data.variants.length > 0 ? (
        <section className="grid-card space-y-3">
          <h2 className="text-2xl">Variants</h2>
          <ul className="space-y-2">
            {data.variants.map((variant) => (
              <li key={variant.id} className="flex items-center justify-between text-sm">
                <span>{variant.label}</span>
                <span className="font-semibold">{formatPrice(variant.priceCents, variant.currency ?? data.currency ?? 'USD')}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.images && data.images.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-2xl">Images</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.images.map((image) => (
              <div key={image.id} className="rounded-xl border border-slate-800 p-2">
                {image.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt={data.title} className="h-48 w-full rounded-lg object-cover" />
                ) : (
                  <p className="text-xs text-slate-500">Image ready once uploaded.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(priceCents / 100);
}
