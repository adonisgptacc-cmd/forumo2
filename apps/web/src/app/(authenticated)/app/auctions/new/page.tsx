import Link from 'next/link';
import { AuctionForm } from './auction-form';

export const metadata = { title: 'Create Auction — Forumo' };

export default function NewAuctionPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={'/auctions' as any} className="text-xs text-slate-400 hover:text-amber-400">
          ← Live Auctions
        </Link>
        <h2 className="mt-2 text-xl font-semibold">Create auction</h2>
        <p className="text-sm text-slate-400">
          Select one of your published listings and configure the auction parameters.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <AuctionForm />
      </div>
    </div>
  );
}
