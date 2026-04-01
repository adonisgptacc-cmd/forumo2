import { OrderDetail } from './order-detail';

export const metadata = { title: 'Order Detail — Forumo' };

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  return <OrderDetail id={params.id} />;
}
