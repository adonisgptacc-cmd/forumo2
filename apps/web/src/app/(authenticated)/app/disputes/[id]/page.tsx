import { DisputeDetail } from './dispute-detail';
import { ErrorBoundary } from '../../../../../components/ErrorBoundary';

export const metadata = { title: 'Dispute — Forumo' };

export default function DisputeDetailPage({ params }: { params: { id: string } }) {
  return (
    <ErrorBoundary>
      <DisputeDetail orderId={params.id} />
    </ErrorBoundary>
  );
}
