import { PayoutsView } from "./payouts-view";

export const metadata = { title: "Payouts — Forumo" };

export default function PayoutsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
          Seller Payouts
        </p>
        <h1 className="text-3xl font-semibold">Your earnings</h1>
        <p className="text-sm text-slate-400">
          Manage your bank connection and withdraw available funds
        </p>
      </div>
      <PayoutsView />
    </div>
  );
}
