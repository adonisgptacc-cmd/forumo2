import { WishlistView } from './wishlist-view';

export const metadata = { title: 'Wishlist — Forumo' };

export default function WishlistPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Wishlist</h2>
        <p className="text-sm text-slate-400">Listings you&apos;ve saved for later</p>
      </div>
      <WishlistView />
    </div>
  );
}
