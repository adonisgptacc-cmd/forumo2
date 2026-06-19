import { DisputeDetail } from './dispute-detail';
import { ErrorBoundary } from '../../../../../components/ErrorBoundary';

export const metadata = { title: 'Dispute — Forumo' };

export default async function DisputeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ErrorBoundary>
      <DisputeDetail orderId={id} />
    </ErrorBoundary>
  );
}
