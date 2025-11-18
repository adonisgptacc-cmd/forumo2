import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { SafeListing } from 'apps/backend/src/modules/listings/listing.serializer';
import { ListingForm } from '../../_components/listing-form';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

async function fetchListing(id: string): Promise<SafeListing | null> {
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

export default async function EditListingPage({ params }: { params: { id: string } }) {
  const listing = await fetchListing(params.id);

  if (!listing) {
    notFound();
  }

  return (
    <main className="space-y-6">
      <Link className="text-sm text-amber-300" href={`/listings/${params.id}`}>
        ← Back to details
      </Link>
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Edit Listing</p>
        <h1 className="text-3xl font-semibold">Update {listing.title}</h1>
        <p className="text-slate-300">Push changes live, add new variants, or refresh product photography.</p>
      </section>
      <ListingForm mode="edit" listing={listing} />
    </main>
  );
}
