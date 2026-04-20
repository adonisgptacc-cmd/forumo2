import { AnalyticsView } from './analytics-view';

export const metadata = { title: 'Analytics — Forumo' };

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Seller Analytics</h1>
        <p className="text-sm text-slate-400 mt-1">Revenue and order performance for your store.</p>
      </div>
      <AnalyticsView />
    </div>
  );
}
