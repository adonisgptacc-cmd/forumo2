import { Suspense } from 'react';
import { OrderDetail } from './order-detail';
import { ErrorBoundary } from '../../../../../components/ErrorBoundary';

export const metadata = { title: 'Order Detail — Forumo' };

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="space-y-4 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-800" />)}</div>}>
        <OrderDetail id={params.id} />
      </Suspense>
    </ErrorBoundary>
  );
}
