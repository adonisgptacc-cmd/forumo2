import { Suspense } from 'react';
import { CheckoutFlow } from './checkout-flow';

export default function CheckoutPage() {
  return (
    <div className="px-4 py-6">
      <Suspense fallback={<div className="card-forumo text-center py-16 text-slate-500">Loading…</div>}>
        <CheckoutFlow />
      </Suspense>
    </div>
  );
}
