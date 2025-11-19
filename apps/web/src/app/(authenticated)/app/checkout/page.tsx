import { CheckoutSimulator } from './checkout-simulator';

export default function CheckoutPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Buyer sandbox</p>
        <h1 className="text-3xl font-semibold">Simulate checkout + escrow funding</h1>
        <p className="text-sm text-slate-400">Experiment with order payloads before wiring up the production client.</p>
      </div>
      <CheckoutSimulator />
    </div>
  );
}
