import { Metadata } from 'next';
import PayoutsView from './payouts-view';

export const metadata: Metadata = { title: 'Payouts — Forumo' };

export default function PayoutsPage() {
  return <PayoutsView />;
}
