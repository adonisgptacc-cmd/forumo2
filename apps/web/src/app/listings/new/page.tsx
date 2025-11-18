import Link from 'next/link';
import { ListingForm } from '../_components/listing-form';

export default function NewListingPage() {
  return (
    <main className="space-y-6">
      <Link className="text-sm text-amber-300" href="/listings">
        ← Back to listings
      </Link>
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Create Listing</p>
        <h1 className="text-3xl font-semibold">New marketplace listing</h1>
        <p className="text-slate-300">Fill out the details, attach photos, and optionally add per-variant pricing.</p>
      </section>
      <ListingForm mode="create" />
    </main>
  );
}
