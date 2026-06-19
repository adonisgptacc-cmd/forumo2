import { ReturnForm } from './return-form';

export const metadata = { title: 'Request Return — Forumo' };

export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReturnForm orderId={id} />;
}
