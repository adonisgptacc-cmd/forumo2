import { StorefrontManager } from './storefront-manager';

export const metadata = { title: 'My Storefront — Forumo' };

export default function StorefrontPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">My Storefront</h2>
        <p className="text-sm text-slate-400">Manage your seller storefront and product collections</p>
      </div>
      <StorefrontManager />
    </div>
  );
}
