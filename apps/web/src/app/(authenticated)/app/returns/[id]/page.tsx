import { ReturnDetail } from './return-detail';

export const metadata = { title: 'Return Detail — Forumo' };

export default function ReturnDetailPage({ params }: { params: { id: string } }) {
  return <ReturnDetail id={params.id} />;
}
