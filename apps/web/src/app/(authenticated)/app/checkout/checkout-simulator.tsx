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
    <form onSubmit={handleSubmit} className="space-y-4 card card-pad">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="subtle">Buyer ID</span>
          <input className="input-forumo"value={buyerId} onChange={(event) => setBuyerId(event.target.value)} placeholder="UUID" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="subtle">Seller ID</span>
          <input className="input-forumo"value={sellerId} onChange={(event) => setSellerId(event.target.value)} placeholder="UUID" />
        </label>
      </div>
      <label className="space-y-2 text-sm">
        <span className="subtle">Listing</span>
        <select className="input-forumo"value={selectedListing} onChange={(event) => setSelectedListing(event.target.value)}>
          <option value="">Select a published listing</option>
          {listings?.data.map((listing) => (
            <option key={listing.id} value={listing.id}>
              {listing.title} ({formatPrice(listing.priceCents, listing.currency ?? 'USD')})
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-2 text-sm">
        <span className="subtle">Quantity</span>
        <input
          type="number"
          min={1}
          className="input-forumo"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-[color:var(--escrow)]">{message}</p> : null}
      <button
        type="submit"
        className="btn btn-primary btn-block"
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
