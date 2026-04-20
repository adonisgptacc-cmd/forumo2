import { SellerReviewsView } from './reviews-view';

export const metadata = { title: 'My Reviews — Forumo' };

export default function SellerReviewsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Reviews</h1>
        <p className="text-sm text-slate-400 mt-1">Your seller rating and review breakdown from buyers.</p>
      </div>
      <SellerReviewsView />
    </div>
  );
}
