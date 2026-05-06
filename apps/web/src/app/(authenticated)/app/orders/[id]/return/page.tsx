import { ReturnForm } from './return-form';

export const metadata = { title: 'Request Return — Forumo' };

export default function ReturnPage({ params }: { params: { id: string } }) {
  return <ReturnForm orderId={params.id} />;
}
