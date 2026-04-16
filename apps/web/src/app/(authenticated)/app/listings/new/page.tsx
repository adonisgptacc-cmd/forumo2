import Link from 'next/link';
import { SellerGate } from '../../../../../components/seller-gate';
import { ListingForm } from '../listing-form';

export const metadata = { title: 'New Listing — Forumo' };

export default function NewListingPage() {
  return (
    <SellerGate>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href={'/app/listings' as any}
            className="text-xs text-slate-400 hover:text-amber-400"
          >
            ← My Listings
          </Link>
          <h2 className="mt-2 text-xl font-semibold">New listing</h2>
          <p className="text-sm text-slate-400">Fill in the details below to list your item.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <ListingForm />
        </div>
      </div>
    </SellerGate>
  );
}
