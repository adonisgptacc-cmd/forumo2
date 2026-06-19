import { SellerDashboard } from './seller-dashboard';

export const metadata = { title: 'Seller Dashboard — Forumo' };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Seller</p>
        <h2 className="h2">Seller Dashboard</h2>
        <p className="text-sm muted mt-0.5">Your sales performance at a glance</p>
      </div>
      <SellerDashboard />
    </div>
  );
}
