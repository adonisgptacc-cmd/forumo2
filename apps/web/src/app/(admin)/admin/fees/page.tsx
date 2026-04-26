import { FeesManager } from './fees-manager';

export const metadata = { title: 'Fee Schedules — Forumo Admin' };

export default function FeesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Fee Schedules</h2>
        <p className="text-sm text-slate-400">Configure platform commission rates per category or globally</p>
      </div>
      <FeesManager />
    </div>
  );
}
