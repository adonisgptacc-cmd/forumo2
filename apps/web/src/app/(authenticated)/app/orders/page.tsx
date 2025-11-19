import { OrdersBoard } from './orders-board';

export default function OrdersPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Orders & Escrow</p>
        <h1 className="text-3xl font-semibold">Keep funds safe until delivery</h1>
        <p className="text-sm text-slate-400">
          Inspect Stripe/Trustap style holds, release windows, and dispute-ready timelines.
        </p>
      </div>
      <OrdersBoard />
    </div>
  );
}
