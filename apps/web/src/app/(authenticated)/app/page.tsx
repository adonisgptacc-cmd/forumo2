import { DashboardOverview } from './dashboard-overview';

export default function AppHomePage() {
  return (
    <div className="space-y-6">
      <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Control center</p>
      <DashboardOverview />
    </div>
  );
}
