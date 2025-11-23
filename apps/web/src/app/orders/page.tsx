'use client';

import { useMemo, useState } from 'react';

import type { OrderTimelineEvent, SafeOrder } from '@forumo/shared';

import { apiBaseUrl, createApiClient } from '../../lib/api-client';
import { formatCurrency } from '../../lib/format-currency';

const defaultBuyer = 'buyer-1';
const defaultSeller = 'seller-1';

type Address = {
  name: string;
  line1: string;
  city: string;
  country: string;
  phone: string;
};

const defaultAddress: Address = {
  name: 'John Doe',
  line1: '123 Market Street',
  city: 'Accra',
  country: 'GH',
  phone: '+233 555 123 456',
};

export default function CheckoutPage() {
  const api = useMemo(() => createApiClient(), []);
  const [buyerId, setBuyerId] = useState(defaultBuyer);
  const [sellerId, setSellerId] = useState(defaultSeller);
  const [listingId, setListingId] = useState('listing-1');
  const [quantity, setQuantity] = useState(1);
  const [shippingCents, setShippingCents] = useState(500);
  const [billingAddress, setBillingAddress] = useState<Address>(defaultAddress);
  const [shippingAddress, setShippingAddress] = useState<Address>({ ...defaultAddress, name: 'Jane Shopper' });
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
          shippingAddress,
          billingAddress,
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

  const cancelPayment = async () => {
    if (!order) return;
    await fetch(`${apiBaseUrl}/orders/payments/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment_intent.canceled',
        data: { object: { metadata: { orderId: order.id }, status: 'canceled' } },
      }),
    });
    await refreshOrder(order.id);
  };

  const releaseEscrow = async () => {
    if (!order) return;
    await fetch(`${apiBaseUrl}/orders/${order.id}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: buyerId, note: 'Buyer confirmed receipt' }),
    });
    await refreshOrder(order.id);
  };

  const refundEscrow = async () => {
    if (!order) return;
    await fetch(`${apiBaseUrl}/orders/${order.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerStatus: 'canceled', actorId: sellerId, note: 'Refund requested' }),
    });
    await refreshOrder(order.id);
  };

  const updateAddress = (type: 'shipping' | 'billing', field: keyof Address, value: string) => {
    if (type === 'shipping') {
      setShippingAddress((prev) => ({ ...prev, [field]: value }));
    } else {
      setBillingAddress((prev) => ({ ...prev, [field]: value }));
    }
  };

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Checkout</p>
        <h1 className="text-3xl font-semibold">Stripe + escrow walkthrough</h1>
        <p className="text-slate-300">
          Provide buyer/seller IDs, shipping and billing details, then walk through payment confirmation, escrow release, or
          refunds to see the timeline update in real time.
        </p>
      </header>

      <section className="grid-card space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Buyer ID</span>
            <input className="form-input" value={buyerId} onChange={(e) => setBuyerId(e.target.value)} placeholder="buyer-uuid" />
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
          <AddressFields title="Shipping address" value={shippingAddress} onChange={(field, val) => updateAddress('shipping', field, val)} />
          <AddressFields title="Billing address" value={billingAddress} onChange={(field, val) => updateAddress('billing', field, val)} />
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button className="btn-primary" onClick={submitOrder} disabled={loading}>
          {loading ? 'Creating order…' : 'Create order + intent'}
        </button>
      </section>

      {order ? (
        <OrderDetails
          order={order}
          onRefresh={() => refreshOrder(order.id)}
          onConfirm={confirmPayment}
          onCancel={cancelPayment}
          onRelease={releaseEscrow}
          onRefund={refundEscrow}
        />
      ) : null}
    </main>
  );
}

function AddressFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: Address;
  onChange: (field: keyof Address, value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
      <p className="text-sm text-slate-300">{title}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <input className="form-input" value={value.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Full name" />
        <input className="form-input" value={value.phone} onChange={(e) => onChange('phone', e.target.value)} placeholder="Phone" />
      </div>
      <input className="form-input" value={value.line1} onChange={(e) => onChange('line1', e.target.value)} placeholder="Street address" />
      <div className="grid gap-3 md:grid-cols-2">
        <input className="form-input" value={value.city} onChange={(e) => onChange('city', e.target.value)} placeholder="City" />
        <input className="form-input" value={value.country} onChange={(e) => onChange('country', e.target.value)} placeholder="Country" />
      </div>
    </div>
  );
}

function OrderDetails({
  order,
  onRefresh,
  onConfirm,
  onCancel,
  onRelease,
  onRefund,
}: {
  order: SafeOrder;
  onRefresh: () => Promise<void>;
  onConfirm: () => Promise<void>;
  onCancel: () => Promise<void>;
  onRelease: () => Promise<void>;
  onRefund: () => Promise<void>;
}) {
  const total = order.totalItemCents + order.shippingCents + order.feeCents;
  const latestPayment = order.payments?.[0];

  const statusBadge = (label: string) => (
    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">{label}</span>
  );

  return (
    <section className="grid-card space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Order {order.orderNumber}</p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold">{order.status}</h2>
            {statusBadge(`Payment: ${order.paymentStatus}`)}
          </div>
          <p className="text-slate-300">Buyer: {order.buyerId} · Seller: {order.sellerId}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn-secondary" onClick={onRefresh}>
            Refresh
          </button>
          <button className="btn-primary" onClick={onConfirm} disabled={order.status === 'PAID'}>
            Confirm payment
          </button>
          <button className="btn-secondary" onClick={onCancel} disabled={order.status === 'CANCELLED'}>
            Cancel intent
          </button>
          <button className="btn-secondary" onClick={onRelease} disabled={order.status !== 'PAID'}>
            Release escrow
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
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-1">
          <p className="text-sm text-slate-300">Payment intent</p>
          <p className="text-lg font-semibold">{latestPayment.providerRef ?? 'Pending intent'}</p>
          <p className="text-sm text-slate-400">Provider status: {latestPayment.providerStatus ?? 'unknown'}</p>
          {latestPayment.metadata?.clientSecret ? (
            <p className="text-xs text-slate-500 break-all">Client secret: {latestPayment.metadata.clientSecret}</p>
          ) : null}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm uppercase tracking-[0.2em] text-slate-500">Timeline</p>
        <div className="grid gap-3">
          {order.timeline?.map((event) => (
            <TimelineCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TimelineCard({ event }: { event: OrderTimelineEvent }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-sm font-semibold">{event.status}</p>
      {event.note ? <p className="text-sm text-slate-400">{event.note}</p> : null}
      <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
    </div>
  );
}
