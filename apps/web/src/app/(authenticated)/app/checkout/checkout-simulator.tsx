'use client';

import type { CreateOrderDto, SafeListing } from '@forumo/shared';
import { useMemo, useState } from 'react';

import { useCreateOrder, useCurrentUser, useListings } from '../../../../lib/react-query/hooks';

export function CheckoutSimulator() {
  const { user } = useCurrentUser();
  const [selectedListing, setSelectedListing] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [buyerId, setBuyerId] = useState('');
  const [sellerId, setSellerId] = useState(user?.id ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: listings } = useListings({ page: 1, pageSize: 20 });
  const createOrder = useCreateOrder();

  const chosenListing: SafeListing | undefined = useMemo(
    () => listings?.data.find((listing) => listing.id === selectedListing),
    [listings, selectedListing],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!buyerId || !sellerId || !chosenListing) {
      setError('Select a listing and fill both party IDs.');
      return;
    }
    setError(null);
    setMessage(null);
    const payload: CreateOrderDto = {
      buyerId,
      sellerId,
      items: [{ listingId: chosenListing.id, quantity }],
      currency: chosenListing.currency ?? 'USD',
      shippingCents: 1200,
      feeCents: 300,
    };
    try {
      const order = await createOrder.mutateAsync(payload);
      setMessage(`Order ${order.orderNumber} created. Escrow ${order.escrow?.status ?? 'PENDING'}.`);
    } catch (err) {
      setError('Unable to create order. Ensure IDs are valid.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Buyer ID</span>
          <input className="input" value={buyerId} onChange={(event) => setBuyerId(event.target.value)} placeholder="UUID" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Seller ID</span>
          <input className="input" value={sellerId} onChange={(event) => setSellerId(event.target.value)} placeholder="UUID" />
        </label>
      </div>
      <label className="space-y-2 text-sm">
        <span className="text-slate-300">Listing</span>
        <select className="input" value={selectedListing} onChange={(event) => setSelectedListing(event.target.value)}>
          <option value="">Select a published listing</option>
          {listings?.data.map((listing) => (
            <option key={listing.id} value={listing.id}>
              {listing.title} ({formatPrice(listing.priceCents, listing.currency ?? 'USD')})
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-2 text-sm">
        <span className="text-slate-300">Quantity</span>
        <input
          type="number"
          min={1}
          className="input"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
        />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      <button
        type="submit"
        className="w-full rounded-md bg-amber-400 px-4 py-2 font-semibold text-slate-900 hover:bg-amber-300"
        disabled={createOrder.isPending}
      >
        {createOrder.isPending ? 'Placing order…' : 'Place escrow order'}
      </button>
    </form>
  );
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(priceCents / 100);
}
