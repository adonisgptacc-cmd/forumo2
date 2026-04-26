import { OrderDetail } from './order-detail';
import { ErrorBoundary } from '../../../../../components/ErrorBoundary';

export const metadata = { title: 'Order Detail — Forumo' };

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  return (
    <ErrorBoundary>
      <OrderDetail id={params.id} />
    </ErrorBoundary>
  );
}
