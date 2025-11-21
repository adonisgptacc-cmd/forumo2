'use client';

import { useMemo, useState } from 'react';

import type { SafeOrder } from '@forumo/shared';

import { apiBaseUrl, createApiClient } from '../../lib/api-client';
import { formatCurrency } from '../../lib/format-currency';

const defaultBuyer = 'buyer-1';
const defaultSeller = 'seller-1';

export default function CheckoutPage() {
  const api = useMemo(() => createApiClient(), []);
  const [buyerId, setBuyerId] = useState(defaultBuyer);
  const [sellerId, setSellerId] = useState(defaultSeller);
  const [listingId, setListingId] = useState('listing-1');
  const [quantity, setQuantity] = useState(1);
  const [shippingCents, setShippingCents] = useState(500);
  const [billingAddress, setBillingAddress] = useState('15 Ring Rd, Accra');
  const [shippingAddress, setShippingAddress] = useState('Airport Residential, Accra');
  const [order, setOrder] = useState<SafeOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        buyerId,
        sellerId,
        items: [{ listingId, quantity }],
        shippingCents,
        feeCents: 250,
        metadata: {
          billingAddress,
          shippingAddress,
        },
      } as any;

      const created = await api.orders.create(payload);
      setOrder(created);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const refreshOrder = async (id: string) => {
    const refreshed = await api.orders.get(id);
    setOrder(refreshed);
  };

  const confirmPayment = async () => {
    if (!order) return;
    await fetch(`${apiBaseUrl}/orders/payments/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment_intent.succeeded',
        data: { object: { metadata: { orderId: order.id }, status: 'succeeded' } },
      }),
    });
    await refreshOrder(order.id);
  };

  const refundPayment = async () => {
    if (!order) return;
    await fetch(`${apiBaseUrl}/orders/${order.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerStatus: 'canceled' }),
    });
    await refreshOrder(order.id);
  };

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Checkout</p>
        <h1 className="text-3xl font-semibold">Create an order and run the Stripe flow</h1>
        <p className="text-slate-300">
          Fill in buyer/seller IDs plus shipping + billing details. We will mint a payment intent, then you can confirm or refund
          it to see escrow + timeline updates reflected in the API response.
        </p>
      </header>

      <section className="grid-card space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Buyer ID</span>
            <input
              className="form-input"
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              placeholder="buyer-uuid"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Seller ID</span>
            <input
              className="form-input"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              placeholder="seller-uuid"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Listing ID</span>
            <input className="form-input" value={listingId} onChange={(e) => setListingId(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Quantity</span>
            <input
              type="number"
              min={1}
              className="form-input"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Shipping (cents)</span>
            <input
              type="number"
              min={0}
              className="form-input"
              value={shippingCents}
              onChange={(e) => setShippingCents(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Shipping address</span>
            <textarea
              className="form-textarea"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              rows={3}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Billing address</span>
            <textarea
              className="form-textarea"
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              rows={3}
            />
          </label>
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button className="btn-primary" onClick={submitOrder} disabled={loading}>
          {loading ? 'Creating order…' : 'Create order + payment intent'}
        </button>
      </section>

      {order ? <OrderDetails order={order} onRefresh={() => refreshOrder(order.id)} onConfirm={confirmPayment} onRefund={refundPayment} /> : null}
    </main>
  );
}

function OrderDetails({
  order,
  onRefresh,
  onConfirm,
  onRefund,
}: {
  order: SafeOrder;
  onRefresh: () => Promise<void>;
  onConfirm: () => Promise<void>;
  onRefund: () => Promise<void>;
}) {
  const total = order.totalItemCents + order.shippingCents + order.feeCents;
  const latestPayment = order.payments?.[0];

  return (
    <section className="grid-card space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Order {order.orderNumber}</p>
          <h2 className="text-2xl font-semibold">Status: {order.status}</h2>
          <p className="text-slate-300">Payment: {order.paymentStatus}</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={onRefresh}>
            Refresh
          </button>
          <button className="btn-primary" onClick={onConfirm} disabled={order.status === 'PAID'}>
            Confirm payment
          </button>
          <button className="btn-secondary" onClick={onRefund} disabled={order.status === 'REFUNDED'}>
            Refund order
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-sm text-slate-300">Totals</p>
        <p className="text-2xl font-semibold">{formatCurrency(total / 100, order.currency)}</p>
        <p className="text-sm text-slate-400">
          Items: {formatCurrency(order.totalItemCents / 100, order.currency)} · Shipping: {formatCurrency(order.shippingCents / 100, order.currency)} · Fees: {formatCurrency(order.feeCents / 100, order.currency)}
        </p>
      </div>

      {latestPayment ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm text-slate-300">Payment intent</p>
          <p className="text-lg font-semibold">{latestPayment.providerRef ?? 'Pending intent'}</p>
          <p className="text-sm text-slate-400">Provider status: {latestPayment.providerStatus ?? 'unknown'}</p>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm uppercase tracking-[0.2em] text-slate-500">Timeline</p>
        <div className="grid gap-3">
          {order.timeline?.map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-sm font-semibold">{event.status}</p>
              {event.note ? <p className="text-sm text-slate-400">{event.note}</p> : null}
              <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
