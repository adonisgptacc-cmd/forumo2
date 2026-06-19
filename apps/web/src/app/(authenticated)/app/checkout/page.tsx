import { Suspense } from 'react';
import { CheckoutFlow } from './checkout-flow';
import { ErrorBoundary } from '../../../../components/ErrorBoundary';

export default function CheckoutPage() {
  return (
    <div className="px-4 py-6">
      <ErrorBoundary>
        <Suspense fallback={<div className="card-forumo text-center py-16 text-slate-500">Loading…</div>}>
          <CheckoutFlow />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
