'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useListing } from '../../../../../../lib/react-query/hooks';
import { ListingForm } from '../../listing-form';

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const { data: listing, isLoading } = useListing(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-slate-800" />
        <div className="h-96 rounded-2xl bg-slate-800" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-2xl text-center py-16">
        <p className="text-slate-400">Listing not found.</p>
        <Link href={'/app/listings' as any} className="mt-4 inline-block text-sm text-amber-400 hover:underline">
          ← Back to My Listings
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={'/app/listings' as any}
          className="text-xs text-slate-400 hover:text-amber-400"
        >
          ← My Listings
        </Link>
        <h2 className="mt-2 text-xl font-semibold">Edit listing</h2>
        <p className="text-sm text-slate-400 truncate">{listing.title}</p>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <ListingForm listing={listing} />
      </div>
    </div>
  );
}
