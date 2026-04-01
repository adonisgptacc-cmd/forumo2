import { SellerDashboard } from './seller-dashboard';

export const metadata = { title: 'Seller Dashboard — Forumo' };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Seller Dashboard</h2>
        <p className="text-sm text-slate-400">Your sales performance at a glance</p>
      </div>
      <SellerDashboard />
    </div>
  );
}
