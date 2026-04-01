import { ListingsManager } from './listings-manager';

export const metadata = { title: 'My Listings — Forumo' };

export default function MyListingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Seller workspace</p>
        <h1 className="text-3xl font-semibold">My Listings</h1>
        <p className="text-sm text-slate-400">Create, edit, and manage your marketplace listings.</p>
      </div>
      <ListingsManager />
    </div>
  );
}
