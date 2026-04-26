import { DisputeDetail } from './dispute-detail';

export const metadata = { title: 'Dispute — Forumo' };

export default function DisputeDetailPage({ params }: { params: { id: string } }) {
  return <DisputeDetail orderId={params.id} />;
}
