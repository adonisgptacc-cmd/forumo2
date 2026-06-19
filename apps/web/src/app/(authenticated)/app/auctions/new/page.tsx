import Link from 'next/link';
import { AuctionForm } from './auction-form';

export const metadata = { title: 'Create Auction — Forumo' };

export default function NewAuctionPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={'/auctions' as any} className="text-xs muted hover:text-[color:var(--accent)]">
          ← Live Auctions
        </Link>
        <h2 className="mt-2 h2">Create auction</h2>
        <p className="text-sm muted">
          Select one of your published listings and configure the auction parameters.
        </p>
      </div>
      <div className="card card-pad">
        <AuctionForm />
      </div>
    </div>
  );
}
